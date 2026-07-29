export interface Contact {
  id: string;
  name: string;
  avatar: string;
  status: string;
  role: string;
}

export const CONTACTS: Contact[] = [
  {
    id: "contact_alex_morgan",
    name: "Alex Morgan",
    avatar: "👩‍💼",
    status: "Online",
    role: "Legal Counsel",
  },
  {
    id: "contact_james_chen",
    name: "James Chen",
    avatar: "👨‍💻",
    status: "Last seen 2h ago",
    role: "Business Partner",
  },
  {
    id: "contact_sarah_vance",
    name: "Sarah Vance",
    avatar: "👩‍🔬",
    status: "Online",
    role: "Research Director",
  },
  {
    id: "contact_michael_thorn",
    name: "Michael Thorn",
    avatar: "🕵️",
    status: "Last seen 1d ago",
    role: "Compliance Officer",
  },
  {
    id: "contact_priya_sharma",
    name: "Priya Sharma",
    avatar: "👩‍⚖️",
    status: "Online",
    role: "International Attorney",
  },
  {
    id: "contact_dr_lee",
    name: "Dr. Wei Lee",
    avatar: "👨‍🏫",
    status: "Last seen 30m ago",
    role: "IP Consultant",
  },
  {
    id: "contact_frank_oslo",
    name: "Frank Oslo",
    avatar: "🧑‍💼",
    status: "Online",
    role: "Venture Capitalist",
  },
  {
    id: "contact_nina_reyes",
    name: "Nina Reyes",
    avatar: "👩‍🎨",
    status: "Last seen 3h ago",
    role: "Creative Director",
  },
];