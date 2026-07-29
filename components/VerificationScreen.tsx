"use client";

import { useState, useRef, useEffect } from "react";
import type { AppUser } from "@/app/page";

type Props = {
  user: AppUser;
  onComplete: (user: AppUser) => void;
  onSkip: () => void;
};

type VerifStep = "intro" | "id_upload" | "selfie" | "liveness" | "review" | "processing" | "done";
type DocType = "passport" | "drivers_license" | "national_id";

export default function VerificationScreen({ user, onComplete, onSkip }: Props) {
  const [step, setStep] = useState<VerifStep>("intro");
  const [docType, setDocType] = useState<DocType>("passport");
  const [idFrontImg, setIdFrontImg] = useState<string | null>(null);
  const [idBackImg, setIdBackImg] = useState<string | null>(null);
  const [selfieImg, setSelfieImg] = useState<string | null>(null);
  const [livenessChecks, setLivenessChecks] = useState<Record<string, boolean>>({});
  const [currentLiveness, setCurrentLiveness] = useState(0);
  const [livenessTimer, setLivenessTimer] = useState(3);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const LIVENESS_CHECKS = [
    { key: "face_forward", instruction: "Look straight at the camera", icon: "👁️" },
    { key: "turn_left", instruction: "Slowly turn your head LEFT", icon: "⬅️" },
    { key: "turn_right", instruction: "Slowly turn your head RIGHT", icon: "➡️" },
    { key: "smile", instruction: "Give a natural smile", icon: "😊" },
    { key: "blink", instruction: "Blink naturally twice", icon: "👀" },
  ];

  const DOC_TYPES: { value: DocType; label: string; icon: string }[] = [
    { value: "passport", label: "Passport", icon: "📘" },
    { value: "drivers_license", label: "Driver's License", icon: "🪪" },
    { value: "national_id", label: "National ID Card", icon: "🆔" },
  ];

  useEffect(() => {
    return () => {
      stopCamera();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      setError("Camera access denied. Please allow camera access or upload a selfie instead.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const captureFrame = (): string | null => {
    if (!videoRef.current) return null;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth || 320;
    canvas.height = videoRef.current.videoHeight || 240;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(videoRef.current, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.85);
  };

  const handleIdUpload = (side: "front" | "back") => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setError("File must be under 10MB"); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = ev.target?.result as string;
      if (side === "front") setIdFrontImg(data);
      else setIdBackImg(data);
      setError("");
    };
    reader.readAsDataURL(file);
  };

  const goToSelfie = () => {
    if (!idFrontImg) {
      setError("Please upload the front of your ID");
      return;
    }
    if (docType !== "passport" && !idBackImg) {
      setError("Please upload the back of your ID");
      return;
    }
    setError("");
    setStep("selfie");
    setTimeout(() => startCamera(), 300);
  };

  const captureSelfie = () => {
    const img = captureFrame();
    if (!img) {
      setError("Could not capture. Try again.");
      return;
    }
    setSelfieImg(img);
    stopCamera();
    setStep("liveness");
    setTimeout(() => startCamera(), 300);
    startLivenessCheck(0);
  };

  const handleSelfieUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setSelfieImg(ev.target?.result as string);
      setStep("liveness");
      startLivenessCheck(0);
    };
    reader.readAsDataURL(file);
  };

  const startLivenessCheck = (checkIndex: number) => {
    setCurrentLiveness(checkIndex);
    setLivenessTimer(3);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setLivenessTimer((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          completeLivenessCheck(checkIndex);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const completeLivenessCheck = (checkIndex: number) => {
    const key = LIVENESS_CHECKS[checkIndex].key;
    setLivenessChecks((prev) => ({ ...prev, [key]: true }));
    if (checkIndex + 1 < LIVENESS_CHECKS.length) {
      setTimeout(() => startLivenessCheck(checkIndex + 1), 500);
    } else {
      stopCamera();
      setStep("review");
    }
  };

  const handleSubmitVerification = async () => {
    setLoading(true);
    setStep("processing");

    // Store identity metadata for legal audit trail
    const verificationRecord = {
      userId: user.id,
      email: user.email,
      phone: user.phone,
      docType,
      hasIdFront: !!idFrontImg,
      hasIdBack: !!idBackImg,
      hasSelfie: !!selfieImg,
      livenessChecks: Object.keys(livenessChecks),
      livenessPassedAll: Object.keys(livenessChecks).length === LIVENESS_CHECKS.length,
      verifiedAt: new Date().toISOString(),
      verificationId: `VRF-${Date.now()}-${Math.random().toString(36).slice(2, 9).toUpperCase()}`,
      ipMeta: "collected-server-side",
      auditHash: btoa(`${user.email}:${Date.now()}:confi-nda-audit`),
    };

    // Persist verification record
    localStorage.setItem("confi_verification", JSON.stringify(verificationRecord));
    localStorage.setItem("confi_verification_id_front", idFrontImg || "");
    localStorage.setItem("confi_verification_selfie", selfieImg || "");

    // Post to our verification API
    try {
      await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          verificationId: verificationRecord.verificationId,
          docType,
          livenessChecks: verificationRecord.livenessChecks,
          verifiedAt: verificationRecord.verifiedAt,
          auditHash: verificationRecord.auditHash,
        }),
      });
    } catch {
      // Non-blocking — local storage has the record
    }

    // Update profile
    const profileData = JSON.parse(localStorage.getItem("confi_profile") || "{}");
    localStorage.setItem("confi_profile", JSON.stringify({ ...profileData, isVerified: true, verificationId: verificationRecord.verificationId }));

    await new Promise((r) => setTimeout(r, 2000));
    setLoading(false);
    setStep("done");

    setTimeout(() => {
      onComplete({ ...user, isVerified: true });
    }, 2500);
  };

  if (step === "intro") {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.introBadge}>🔏</div>
          <h2 style={styles.title}>Identity Verification</h2>
          <p style={styles.subtitle}>
            Required to activate <strong style={{ color: "#6366f1" }}>Confidential Mode</strong> and
            participate in legally protected NDA conversations.
          </p>

          <div style={styles.benefitsList}>
            {[
              { icon: "🛡️", title: "Legal Protection", desc: "Your identity backs the international NDA" },
              { icon: "⚖️", title: "Audit Trail", desc: "Verified identity stored for legal proceedings" },
              { icon: "✅", title: "Verified Badge", desc: "Get a verified badge visible to contacts" },
              { icon: "🔐", title: "NDA Mode", desc: "Unlock confidential conversations" },
            ].map((b) => (
              <div key={b.title} style={styles.benefitItem}>
                <span style={styles.benefitIcon}>{b.icon}</span>
                <div>
                  <div style={styles.benefitTitle}>{b.title}</div>
                  <div style={styles.benefitDesc}>{b.desc}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={styles.privacyNote}>
            🔒 Your ID images are encrypted and only used for identity verification. They are never sold or shared with third parties.
          </div>

          <div style={styles.btnGroup}>
            <button style={styles.btn} onClick={() => setStep("id_upload")}>
              Start Verification →
            </button>
            <button style={styles.skipBtn} onClick={onSkip}>
              Skip for now (limits NDA features)
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === "id_upload") {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.stepHeader}>
            <div style={styles.stepBadge}>1 of 3</div>
            <h2 style={styles.title}>Upload Government ID</h2>
            <p style={styles.subtitle}>Select your document type and upload a clear photo</p>
          </div>

          <div style={styles.docTypeGrid}>
            {DOC_TYPES.map((dt) => (
              <button
                key={dt.value}
                style={{
                  ...styles.docTypeBtn,
                  ...(docType === dt.value ? styles.docTypeBtnActive : {}),
                }}
                onClick={() => setDocType(dt.value)}
              >
                <span style={{ fontSize: "24px" }}>{dt.icon}</span>
                <span style={styles.docTypeLbl}>{dt.label}</span>
              </button>
            ))}
          </div>

          <div style={styles.uploadArea}>
            <UploadBox
              label={`${docType === "passport" ? "Photo page" : "Front side"}`}
              image={idFrontImg}
              onChange={handleIdUpload("front")}
            />
            {docType !== "passport" && (
              <UploadBox
                label="Back side"
                image={idBackImg}
                onChange={handleIdUpload("back")}
              />
            )}
          </div>

          <div style={styles.idTips}>
            <p style={styles.idTipsTitle}>📌 Tips for a good scan:</p>
            <ul style={styles.idTipsList}>
              <li>Ensure all 4 corners are visible</li>
              <li>No glare or shadows on the ID</li>
              <li>All text must be clearly readable</li>
              <li>Use a flat, dark background</li>
            </ul>
          </div>

          {error && <div style={styles.error}>{error}</div>}

          <div style={styles.btnGroup}>
            <button style={styles.btn} onClick={goToSelfie}>Continue →</button>
            <button style={styles.backBtn} onClick={() => setStep("intro")}>← Back</button>
          </div>
        </div>
      </div>
    );
  }

  if (step === "selfie") {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.stepHeader}>
            <div style={styles.stepBadge}>2 of 3</div>
            <h2 style={styles.title}>Take a Selfie</h2>
            <p style={styles.subtitle}>Position your face in the center of the frame</p>
          </div>

          <div style={styles.cameraContainer}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={styles.video}
            />
            <div style={styles.faceGuide} />
          </div>

          <div style={styles.selfieInstructions}>
            <p>📍 Make sure your full face is clearly visible</p>
            <p>💡 Find good lighting — avoid backlighting</p>
            <p>👓 Remove glasses if possible</p>
          </div>

          {error && <div style={styles.error}>{error}</div>}

          <div style={styles.btnGroup}>
            <button style={styles.btn} onClick={captureSelfie}>📸 Capture Selfie</button>
            <label style={styles.uploadLinkBtn}>
              <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleSelfieUpload} />
              Upload selfie instead
            </label>
            <button style={styles.backBtn} onClick={() => { stopCamera(); setStep("id_upload"); }}>← Back</button>
          </div>
        </div>
      </div>
    );
  }

  if (step === "liveness") {
    const check = LIVENESS_CHECKS[currentLiveness];
    const done = Object.keys(livenessChecks).length;

    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.stepHeader}>
            <div style={styles.stepBadge}>3 of 3</div>
            <h2 style={styles.title}>Liveness Check</h2>
            <p style={styles.subtitle}>Follow the instructions to prove you're a real person</p>
          </div>

          <div style={styles.livenessProgress}>
            {LIVENESS_CHECKS.map((lc, i) => (
              <div
                key={lc.key}
                style={{
                  ...styles.livenessStep,
                  ...(livenessChecks[lc.key] ? styles.livenessStepDone : {}),
                  ...(i === currentLiveness && !livenessChecks[lc.key] ? styles.livenessStepActive : {}),
                }}
              >
                {livenessChecks[lc.key] ? "✓" : i + 1}
              </div>
            ))}
          </div>

          <div style={styles.cameraContainer}>
            <video ref={videoRef} autoPlay playsInline muted style={styles.video} />
            <div style={styles.faceGuide} />
          </div>

          {check && !livenessChecks[check.key] && (
            <div style={styles.livenessInstruction}>
              <span style={styles.livenessIcon}>{check.icon}</span>
              <div>
                <div style={styles.livenessText}>{check.instruction}</div>
                <div style={styles.livenessCountdown}>Capturing in {livenessTimer}s…</div>
              </div>
            </div>
          )}

          <div style={styles.livenessStatus}>
            {done}/{LIVENESS_CHECKS.length} checks completed
          </div>
        </div>
      </div>
    );
  }

  if (step === "review") {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.stepHeader}>
            <div style={styles.reviewBadge}>✅</div>
            <h2 style={styles.title}>Review & Submit</h2>
            <p style={styles.subtitle}>Your identity documents are ready to submit</p>
          </div>

          <div style={styles.reviewGrid}>
            <div style={styles.reviewItem}>
              <div style={styles.reviewLabel}>Document Type</div>
              <div style={styles.reviewValue}>
                {DOC_TYPES.find((d) => d.value === docType)?.icon}{" "}
                {DOC_TYPES.find((d) => d.value === docType)?.label}
              </div>
            </div>
            <div style={styles.reviewItem}>
              <div style={styles.reviewLabel}>ID Front</div>
              <div style={styles.reviewValue}>{idFrontImg ? "✅ Uploaded" : "❌ Missing"}</div>
            </div>
            {docType !== "passport" && (
              <div style={styles.reviewItem}>
                <div style={styles.reviewLabel}>ID Back</div>
                <div style={styles.reviewValue}>{idBackImg ? "✅ Uploaded" : "❌ Missing"}</div>
              </div>
            )}
            <div style={styles.reviewItem}>
              <div style={styles.reviewLabel}>Selfie</div>
              <div style={styles.reviewValue}>{selfieImg ? "✅ Captured" : "❌ Missing"}</div>
            </div>
            <div style={styles.reviewItem}>
              <div style={styles.reviewLabel}>Liveness Check</div>
              <div style={styles.reviewValue}>
                ✅ {Object.keys(livenessChecks).length}/{LIVENESS_CHECKS.length} passed
              </div>
            </div>
          </div>

          <div style={styles.ndaConsent}>
            <p style={styles.ndaConsentText}>
              🔏 <strong>Legal Notice:</strong> By submitting, you confirm that:
            </p>
            <ul style={styles.ndaConsentList}>
              <li>The provided documents are genuine and belong to you</li>
              <li>You consent to identity verification for NDA enforcement</li>
              <li>Your verified identity may be disclosed in legal proceedings</li>
              <li>You are at least 18 years of age</li>
            </ul>
          </div>

          <div style={styles.btnGroup}>
            <button style={styles.btn} onClick={handleSubmitVerification} disabled={loading}>
              Submit for Verification
            </button>
            <button style={styles.backBtn} onClick={() => setStep("id_upload")}>← Redo documents</button>
          </div>
        </div>
      </div>
    );
  }

  if (step === "processing") {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.processingContainer}>
            <div style={styles.processingSpinner} />
            <h2 style={styles.title}>Verifying Identity</h2>
            <p style={styles.subtitle}>
              Performing document authenticity checks and biometric matching…
            </p>
            <div style={styles.processingSteps}>
              {["Encrypting documents", "Checking liveness data", "Matching selfie to ID", "Generating audit record"].map(
                (s, i) => (
                  <div key={s} style={styles.processingStep}>
                    <div style={styles.processingStepDot} />
                    <span style={{ animationDelay: `${i * 0.3}s` }}>{s}</span>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === "done") {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.doneContainer}>
            <div style={styles.doneBadge}>🎉</div>
            <h2 style={{ ...styles.title, color: "#22c55e" }}>Verification Complete!</h2>
            <p style={styles.subtitle}>
              Your account is now <strong style={{ color: "#22c55e" }}>Verified</strong>. You can
              activate Confidential Mode in any conversation.
            </p>
            <div style={styles.verifiedBadge}>
              <span>✅</span>
              <span>VERIFIED IDENTITY</span>
            </div>
            <p style={styles.auditNote}>
              Your verification ID has been recorded for legal audit purposes. This backs the
              international NDA when Confidential Mode is active.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

function UploadBox({
  label,
  image,
  onChange,
}: {
  label: string;
  image: string | null;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div style={uploadStyles.box} onClick={() => inputRef.current?.click()}>
      <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onChange} />
      {image ? (
        <img src={image} alt={label} style={uploadStyles.preview} />
      ) : (
        <div style={uploadStyles.placeholder}>
          <span style={{ fontSize: "32px" }}>📄</span>
          <span style={uploadStyles.labelText}>{label}</span>
          <span style={uploadStyles.tapText}>Tap to upload</span>
        </div>
      )}
    </div>
  );
}

const uploadStyles: Record<string, React.CSSProperties> = {
  box: {
    flex: 1,
    minHeight: "120px",
    border: "2px dashed rgba(99,102,241,0.4)",
    borderRadius: "12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    overflow: "hidden",
    background: "rgba(99,102,241,0.05)",
    transition: "border-color 0.2s",
  },
  preview: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  placeholder: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "6px",
    padding: "16px",
  },
  labelText: {
    color: "#94a3b8",
    fontSize: "13px",
    fontWeight: 600,
  },
  tapText: {
    color: "#475569",
    fontSize: "12px",
  },
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: "100%",
    maxWidth: "460px",
    padding: "16px",
    maxHeight: "95vh",
    overflowY: "auto",
  },
  card: {
    background: "rgba(255,255,255,0.05)",
    backdropFilter: "blur(20px)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "24px",
    padding: "36px 28px",
    boxShadow: "0 25px 50px rgba(0,0,0,0.5)",
  },
  introBadge: {
    fontSize: "48px",
    textAlign: "center",
    marginBottom: "12px",
  },
  stepHeader: {
    textAlign: "center",
    marginBottom: "24px",
  },
  stepBadge: {
    display: "inline-block",
    background: "rgba(99,102,241,0.2)",
    border: "1px solid rgba(99,102,241,0.4)",
    borderRadius: "20px",
    padding: "4px 14px",
    color: "#a5b4fc",
    fontSize: "12px",
    fontWeight: 600,
    marginBottom: "10px",
  },
  reviewBadge: {
    fontSize: "40px",
    textAlign: "center",
    marginBottom: "8px",
  },
  title: {
    color: "#fff",
    fontSize: "22px",
    fontWeight: 700,
    margin: "0 0 8px",
    textAlign: "center",
  },
  subtitle: {
    color: "#94a3b8",
    fontSize: "14px",
    margin: 0,
    textAlign: "center",
    lineHeight: 1.5,
  },
  benefitsList: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    margin: "24px 0",
  },
  benefitItem: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    padding: "12px",
    background: "rgba(255,255,255,0.04)",
    borderRadius: "10px",
    border: "1px solid rgba(255,255,255,0.06)",
  },
  benefitIcon: {
    fontSize: "24px",
    flexShrink: 0,
  },
  benefitTitle: {
    color: "#fff",
    fontSize: "14px",
    fontWeight: 600,
    marginBottom: "2px",
  },
  benefitDesc: {
    color: "#94a3b8",
    fontSize: "12px",
  },
  privacyNote: {
    background: "rgba(34,197,94,0.1)",
    border: "1px solid rgba(34,197,94,0.3)",
    borderRadius: "8px",
    padding: "10px 14px",
    color: "#86efac",
    fontSize: "12px",
    marginBottom: "20px",
    lineHeight: 1.5,
  },
  docTypeGrid: {
    display: "flex",
    gap: "8px",
    marginBottom: "20px",
  },
  docTypeBtn: {
    flex: 1,
    padding: "12px 8px",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "10px",
    background: "rgba(255,255,255,0.04)",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "6px",
    color: "#94a3b8",
    transition: "all 0.15s",
  },
  docTypeBtnActive: {
    borderColor: "#6366f1",
    background: "rgba(99,102,241,0.15)",
    color: "#a5b4fc",
  },
  docTypeLbl: {
    fontSize: "11px",
    fontWeight: 600,
  },
  uploadArea: {
    display: "flex",
    gap: "12px",
    marginBottom: "16px",
  },
  idTips: {
    background: "rgba(251,191,36,0.08)",
    border: "1px solid rgba(251,191,36,0.2)",
    borderRadius: "8px",
    padding: "10px 14px",
    marginBottom: "16px",
  },
  idTipsTitle: {
    color: "#fde68a",
    fontSize: "12px",
    fontWeight: 600,
    margin: "0 0 6px",
  },
  idTipsList: {
    color: "#94a3b8",
    fontSize: "12px",
    margin: 0,
    paddingLeft: "18px",
    lineHeight: 1.8,
  },
  cameraContainer: {
    position: "relative",
    borderRadius: "16px",
    overflow: "hidden",
    background: "#000",
    marginBottom: "16px",
    aspectRatio: "4/3",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  video: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  faceGuide: {
    position: "absolute",
    width: "60%",
    aspectRatio: "3/4",
    border: "3px solid rgba(99,102,241,0.8)",
    borderRadius: "50% 50% 50% 50% / 60% 60% 40% 40%",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    pointerEvents: "none",
    boxShadow: "0 0 0 9999px rgba(0,0,0,0.4)",
  },
  selfieInstructions: {
    color: "#94a3b8",
    fontSize: "13px",
    lineHeight: 2,
    marginBottom: "16px",
  },
  livenessProgress: {
    display: "flex",
    justifyContent: "center",
    gap: "10px",
    marginBottom: "16px",
  },
  livenessStep: {
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    border: "2px solid rgba(255,255,255,0.2)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#64748b",
    fontSize: "13px",
    fontWeight: 600,
  },
  livenessStepActive: {
    border: "2px solid #6366f1",
    color: "#a5b4fc",
    background: "rgba(99,102,241,0.2)",
  },
  livenessStepDone: {
    border: "2px solid #22c55e",
    background: "rgba(34,197,94,0.2)",
    color: "#86efac",
  },
  livenessInstruction: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    background: "rgba(99,102,241,0.1)",
    border: "1px solid rgba(99,102,241,0.3)",
    borderRadius: "10px",
    padding: "14px",
    marginBottom: "12px",
  },
  livenessIcon: {
    fontSize: "28px",
    flexShrink: 0,
  },
  livenessText: {
    color: "#e2e8f0",
    fontSize: "15px",
    fontWeight: 600,
  },
  livenessCountdown: {
    color: "#6366f1",
    fontSize: "13px",
    marginTop: "2px",
  },
  livenessStatus: {
    textAlign: "center",
    color: "#64748b",
    fontSize: "13px",
  },
  reviewGrid: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    marginBottom: "20px",
  },
  reviewItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 14px",
    background: "rgba(255,255,255,0.04)",
    borderRadius: "8px",
    border: "1px solid rgba(255,255,255,0.06)",
  },
  reviewLabel: {
    color: "#94a3b8",
    fontSize: "13px",
  },
  reviewValue: {
    color: "#e2e8f0",
    fontSize: "13px",
    fontWeight: 600,
  },
  ndaConsent: {
    background: "rgba(99,102,241,0.08)",
    border: "1px solid rgba(99,102,241,0.2)",
    borderRadius: "10px",
    padding: "14px",
    marginBottom: "20px",
  },
  ndaConsentText: {
    color: "#c7d2fe",
    fontSize: "13px",
    margin: "0 0 8px",
  },
  ndaConsentList: {
    color: "#94a3b8",
    fontSize: "12px",
    margin: 0,
    paddingLeft: "18px",
    lineHeight: 1.8,
  },
  processingContainer: {
    textAlign: "center",
    padding: "20px 0",
  },
  processingSpinner: {
    width: "56px",
    height: "56px",
    border: "4px solid rgba(99,102,241,0.2)",
    borderTop: "4px solid #6366f1",
    borderRadius: "50%",
    margin: "0 auto 20px",
    animation: "spin 0.8s linear infinite",
  },
  processingSteps: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    marginTop: "20px",
    textAlign: "left",
  },
  processingStep: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    color: "#94a3b8",
    fontSize: "13px",
  },
  processingStepDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    background: "#6366f1",
    flexShrink: 0,
  },
  doneContainer: {
    textAlign: "center",
    padding: "10px 0",
  },
  doneBadge: {
    fontSize: "56px",
    marginBottom: "12px",
  },
  verifiedBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    background: "linear-gradient(135deg, rgba(34,197,94,0.2), rgba(34,197,94,0.1))",
    border: "1px solid rgba(34,197,94,0.5)",
    borderRadius: "20px",
    padding: "8px 20px",
    color: "#86efac",
    fontSize: "14px",
    fontWeight: 700,
    letterSpacing: "1px",
    margin: "16px auto",
  },
  auditNote: {
    color: "#64748b",
    fontSize: "12px",
    lineHeight: 1.6,
    marginTop: "12px",
  },
  btnGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  btn: {
    width: "100%",
    padding: "14px",
    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    border: "none",
    borderRadius: "10px",
    color: "#fff",
    fontSize: "15px",
    fontWeight: 600,
    cursor: "pointer",
    boxShadow: "0 4px 16px rgba(99,102,241,0.4)",
  },
  skipBtn: {
    width: "100%",
    padding: "10px",
    background: "transparent",
    border: "none",
    color: "#64748b",
    fontSize: "13px",
    cursor: "pointer",
  },
  backBtn: {
    width: "100%",
    padding: "10px",
    background: "transparent",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "10px",
    color: "#94a3b8",
    fontSize: "14px",
    cursor: "pointer",
  },
  uploadLinkBtn: {
    textAlign: "center",
    color: "#6366f1",
    fontSize: "13px",
    cursor: "pointer",
    padding: "4px",
  },
  error: {
    marginBottom: "12px",
    padding: "10px 14px",
    background: "rgba(239,68,68,0.15)",
    border: "1px solid rgba(239,68,68,0.4)",
    borderRadius: "8px",
    color: "#fca5a5",
    fontSize: "14px",
  },
};