// Default questions seeded into your Answers bank on first login.
// `aliases` are phrases the Chrome extension looks for in a form field's
// label / placeholder / name to decide which answer to fill.

/** How a question is answered in the Profile form. Answers are always stored as text. */
export type Field =
  | { kind: "text"; type?: "text" | "email" | "tel" | "url"; numeric?: boolean }
  | { kind: "number"; unit?: string; step?: number; min?: number; max?: number }
  | { kind: "date" }
  /** Dropdown: one of a fixed list */
  | { kind: "select"; options: Option[] }
  /** Segmented buttons for 2–4 short options (Yes / No) */
  | { kind: "choice"; options: string[] }
  /** Several of a list, stored comma-separated; `custom` lets you add your own */
  | { kind: "multi"; options: string[]; custom?: boolean }
  /** Type freely with suggestions */
  | { kind: "combo"; options: string[] };

/** A plain string, or [stored value, label shown in the list] */
export type Option = string | [string, string];

export type SeedQuestion = {
  key: string;
  category: Category;
  question: string;
  aliases: string[];
  long_form?: boolean;
  /** Example answer, shown as "e.g. …" */
  hint?: string;
  /** Placeholder shown as written (guidance, not an example) */
  help?: string;
  field?: Field;
};

export const CATEGORIES = [
  { id: "personal", label: "Personal & contact" },
  { id: "links", label: "Profiles & links" },
  { id: "craft", label: "Your craft" },
  { id: "work", label: "Current role & compensation" },
  { id: "preferences", label: "Availability & preferences" },
  { id: "education", label: "Education" },
  { id: "authorization", label: "Work authorization" },
  { id: "screening", label: "Screening questions" },
  { id: "eeo", label: "Diversity (EEO) — optional" },
  { id: "long", label: "Long answers" },
  { id: "other", label: "Custom" },
] as const;

export type Category = (typeof CATEGORIES)[number]["id"];

// ── Option lists
const YES_NO = ["Yes", "No"];
const yesNo: Field = { kind: "choice", options: YES_NO };
const url: Field = { kind: "text", type: "url" };
const DECLINE = "Decline to self-identify";

const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: THIS_YEAR + 5 - 1975 + 1 }, (_, i) => String(THIS_YEAR + 5 - i));

const COUNTRIES = [
  "India", "United States", "United Kingdom", "Canada", "Australia", "Germany", "Netherlands", "Ireland", "France", "Singapore",
  "United Arab Emirates", "Saudi Arabia", "Qatar", "Japan", "South Korea", "Sweden", "Denmark", "Finland", "Norway", "Switzerland",
  "Spain", "Portugal", "Italy", "Poland", "New Zealand", "Malaysia", "Indonesia", "Philippines", "Vietnam", "Thailand",
  "Sri Lanka", "Bangladesh", "Nepal", "Pakistan", "Israel", "South Africa", "Nigeria", "Kenya", "Brazil", "Mexico", "Argentina",
];
const NATIONALITIES = [
  "Indian", "American", "British", "Canadian", "Australian", "German", "Dutch", "Irish", "French", "Singaporean", "Emirati",
  "Japanese", "Korean", "Swedish", "Spanish", "Italian", "New Zealander", "Malaysian", "Sri Lankan", "Bangladeshi", "Nepali",
  "Pakistani", "Filipino", "Brazilian", "Mexican",
];
const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana", "Himachal Pradesh",
  "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha",
  "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir",
  "Ladakh", "Lakshadweep", "Puducherry",
];
const CITIES = [
  "Bengaluru", "Mumbai", "Pune", "Hyderabad", "New Delhi", "Gurugram", "Noida", "Chennai", "Kolkata", "Ahmedabad", "Jaipur",
  "Kochi", "Chandigarh", "Indore", "Coimbatore", "Thiruvananthapuram", "Bhubaneswar", "Nagpur", "Goa", "Lucknow",
  "Singapore", "Dubai", "London", "Berlin", "Amsterdam", "Dublin", "Toronto", "San Francisco", "New York", "Seattle",
];
const DIAL_CODES: Option[] = [
  ["+91", "+91 India"], ["+1", "+1 US / Canada"], ["+44", "+44 United Kingdom"], ["+61", "+61 Australia"], ["+49", "+49 Germany"],
  ["+31", "+31 Netherlands"], ["+353", "+353 Ireland"], ["+33", "+33 France"], ["+65", "+65 Singapore"], ["+971", "+971 UAE"],
  ["+966", "+966 Saudi Arabia"], ["+974", "+974 Qatar"], ["+81", "+81 Japan"], ["+82", "+82 South Korea"], ["+46", "+46 Sweden"],
  ["+41", "+41 Switzerland"], ["+34", "+34 Spain"], ["+64", "+64 New Zealand"], ["+60", "+60 Malaysia"], ["+94", "+94 Sri Lanka"],
  ["+880", "+880 Bangladesh"], ["+977", "+977 Nepal"], ["+92", "+92 Pakistan"], ["+27", "+27 South Africa"], ["+55", "+55 Brazil"],
];

export const SEED_QUESTIONS: SeedQuestion[] = [
  // ── Personal & contact
  { key: "full_name", category: "personal", question: "Full name", aliases: ["full name", "your name", "legal name", "candidate name", "name"], help: "As on your ID" },
  { key: "first_name", category: "personal", question: "First name", aliases: ["first name", "given name", "firstname", "fname"] },
  { key: "last_name", category: "personal", question: "Last name", aliases: ["last name", "surname", "family name", "lastname", "lname"] },
  { key: "preferred_name", category: "personal", question: "Preferred name", aliases: ["preferred name", "preferred first name", "nickname"], help: "What you like to be called" },
  { key: "pronouns", category: "personal", question: "Pronouns", aliases: ["pronouns"], field: { kind: "select", options: ["she/her", "he/him", "they/them", "she/they", "he/they", "Prefer not to say"] } },
  { key: "date_of_birth", category: "personal", question: "Date of birth", aliases: ["date of birth", "dob", "birth date"], field: { kind: "date" } },
  { key: "email", category: "personal", question: "Email", aliases: ["email", "e-mail", "email address"], hint: "you@example.com", field: { kind: "text", type: "email" } },
  { key: "phone_country_code", category: "personal", question: "Phone country code", aliases: ["country code", "dial code", "phone country"], field: { kind: "select", options: DIAL_CODES } },
  { key: "phone", category: "personal", question: "Phone number", aliases: ["phone", "mobile", "contact number", "phone number", "telephone", "cell"], hint: "98765 43210", field: { kind: "text", type: "tel" } },
  { key: "address", category: "personal", question: "Street address", aliases: ["address", "street address", "address line 1", "residential address"], help: "Flat, building, street, area" },
  { key: "city", category: "personal", question: "City", aliases: ["city", "current city", "current location", "location city", "where are you based", "location"], hint: "Bengaluru", field: { kind: "combo", options: CITIES } },
  { key: "state", category: "personal", question: "State", aliases: ["state", "province", "region"], hint: "Karnataka", field: { kind: "combo", options: INDIAN_STATES } },
  { key: "postal_code", category: "personal", question: "PIN / postal code", aliases: ["postal code", "zip", "pin code", "pincode", "zip code"], hint: "560001", field: { kind: "text", numeric: true } },
  { key: "country", category: "personal", question: "Country", aliases: ["country", "country of residence"], hint: "India", field: { kind: "combo", options: COUNTRIES } },

  // ── Links
  { key: "linkedin", category: "links", question: "LinkedIn", aliases: ["linkedin", "linkedin profile", "linkedin url"], hint: "https://linkedin.com/in/yourname", field: url },
  { key: "portfolio", category: "links", question: "Portfolio / personal website", aliases: ["portfolio", "website", "personal website", "personal site", "blog", "other website"], field: url },
  { key: "portfolio_password", category: "links", question: "Portfolio password", aliases: ["portfolio password", "password for portfolio"], help: "Leave empty if it isn't protected" },
  { key: "dribbble", category: "links", question: "Dribbble", aliases: ["dribbble"], hint: "https://dribbble.com/yourname", field: url },
  { key: "behance", category: "links", question: "Behance", aliases: ["behance"], hint: "https://behance.net/yourname", field: url },
  { key: "github", category: "links", question: "GitHub", aliases: ["github", "github profile", "github url"], hint: "https://github.com/yourname", field: url },
  { key: "other_link", category: "links", question: "Other profile (X, Medium, …)", aliases: ["other link", "other profile", "twitter", "x profile"], help: "https://", field: url },

  // ── Your craft
  { key: "design_focus", category: "craft", question: "Design focus", aliases: ["design focus", "specialization", "area of expertise"],
    field: { kind: "multi", custom: true, options: ["Product design", "UX design", "Interaction design", "Visual / UI design", "UX research", "Design systems", "Motion design", "Brand design", "Service design", "Content design"] } },
  { key: "design_tools", category: "craft", question: "Design tools", aliases: ["design tools", "tools", "software proficiency", "figma"],
    field: { kind: "multi", custom: true, options: ["Figma", "FigJam", "Framer", "ProtoPie", "Sketch", "Adobe XD", "Illustrator", "Photoshop", "After Effects", "Rive", "Spline", "Webflow", "Miro", "Maze", "Dovetail", "Notion", "Jira"] } },
  { key: "research_methods", category: "craft", question: "Research methods you've used", aliases: ["research methods", "user research", "usability testing"],
    field: { kind: "multi", custom: true, options: ["User interviews", "Usability testing", "Surveys", "A/B testing", "Card sorting", "Tree testing", "Contextual inquiry", "Diary studies", "Heuristic evaluation", "Analytics review", "Competitive analysis"] } },
  { key: "design_systems", category: "craft", question: "Design systems experience", aliases: ["design system", "component library"],
    field: { kind: "select", options: ["Built one from scratch", "Led or maintained one", "Contributed components to one", "Used one day to day", "No experience yet"] } },
  { key: "languages_code", category: "craft", question: "Code you can work with", aliases: ["programming languages", "languages you code", "coding languages", "technical skills"],
    field: { kind: "multi", custom: true, options: ["HTML", "CSS", "JavaScript", "TypeScript", "React", "Next.js", "Tailwind CSS", "SwiftUI", "Python", "SQL", "None"] } },
  { key: "ai_tools", category: "craft", question: "AI tools you build with", aliases: ["ai tools", "generative ai", "llm", "prompt", "cursor", "copilot", "ai agents"],
    field: { kind: "multi", custom: true, options: ["Claude", "Claude Code", "ChatGPT", "Gemini", "Cursor", "GitHub Copilot", "v0", "Lovable", "Bolt", "Figma Make", "Midjourney"] } },
  { key: "open_source", category: "craft", question: "Open-source work", aliases: ["open source", "oss contributions"], help: "Link to a project or contribution", field: url },
  { key: "shipped_products", category: "craft", question: "Products you've shipped", aliases: ["shipped", "products you have worked on", "live products"], long_form: true, help: "One per line: product, what you did, link" },

  // ── Current role & compensation
  { key: "current_company", category: "work", question: "Current / most recent company", aliases: ["current company", "current employer", "most recent employer", "company name", "employer"], help: "Company name" },
  { key: "current_title", category: "work", question: "Current / most recent job title", aliases: ["current title", "current job title", "current designation", "designation", "current role", "job title"], hint: "Senior Product Designer" },
  { key: "total_experience", category: "work", question: "Total experience (years)", aliases: ["total experience", "years of experience", "how many years", "total years", "work experience years", "experience in years"], hint: "4.5", field: { kind: "number", unit: "years", step: 0.5, min: 0, max: 50 } },
  { key: "relevant_experience", category: "work", question: "Relevant experience (years)", aliases: ["relevant experience", "years of relevant experience", "experience in this field"], hint: "4", field: { kind: "number", unit: "years", step: 0.5, min: 0, max: 50 } },
  { key: "current_ctc", category: "work", question: "Current CTC (lakhs per year)", aliases: ["current ctc", "current salary", "current compensation", "current annual", "present salary", "current package"], hint: "18", field: { kind: "number", unit: "LPA", step: 0.5, min: 0 } },
  { key: "expected_ctc", category: "work", question: "Expected CTC (lakhs per year)", aliases: ["expected ctc", "expected salary", "salary expectation", "desired salary", "expected compensation", "compensation expectation"], hint: "26", field: { kind: "number", unit: "LPA", step: 0.5, min: 0 } },
  { key: "skills", category: "work", question: "Key skills", aliases: ["skills", "key skills", "technical skills", "core skills", "tech stack"],
    field: { kind: "multi", custom: true, options: ["User research", "Wireframing", "Prototyping", "Interaction design", "Visual design", "Design systems", "Usability testing", "Information architecture", "Accessibility", "Motion design", "Product strategy", "Data-informed design", "Workshop facilitation"] } },
  { key: "languages", category: "work", question: "Languages you speak", aliases: ["languages", "languages spoken", "language proficiency"],
    field: { kind: "multi", custom: true, options: ["English", "Hindi", "Marathi", "Kannada", "Tamil", "Telugu", "Malayalam", "Bengali", "Gujarati", "Punjabi", "Urdu", "French", "German", "Spanish", "Japanese"] } },

  // ── Availability & preferences
  { key: "notice_period", category: "preferences", question: "Notice period", aliases: ["notice period", "notice", "how soon can you join", "joining time"],
    field: { kind: "select", options: ["Immediate", "15 days", "30 days", "45 days", "60 days", "90 days"] } },
  { key: "serving_notice", category: "preferences", question: "Currently serving notice?", aliases: ["serving notice", "currently serving", "on notice"], field: yesNo },
  { key: "last_working_day", category: "preferences", question: "Last working day", aliases: ["last working day", "lwd", "last day"], help: "Only if you're serving notice", field: { kind: "date" } },
  { key: "start_date", category: "preferences", question: "Earliest start date", aliases: ["start date", "earliest start", "available to start", "date available", "availability", "when can you start"], field: { kind: "date" } },
  { key: "work_mode", category: "preferences", question: "Work modes you're open to", aliases: ["remote", "hybrid", "onsite", "on-site", "work from office", "work mode", "work arrangement", "comfortable working from office"],
    field: { kind: "multi", options: ["Remote", "Hybrid", "Onsite"] } },
  { key: "relocate", category: "preferences", question: "Open to relocation?", aliases: ["relocate", "relocation", "willing to relocate", "open to relocation"], field: { kind: "choice", options: ["Yes", "No", "Depends on role"] } },
  { key: "preferred_locations", category: "preferences", question: "Preferred locations", aliases: ["preferred location", "preferred locations", "location preference", "which location"],
    field: { kind: "multi", custom: true, options: ["Bengaluru", "Mumbai", "Pune", "Hyderabad", "Delhi NCR", "Chennai", "Kolkata", "Ahmedabad", "Remote"] } },
  { key: "travel", category: "preferences", question: "Willing to travel", aliases: ["travel", "willing to travel"],
    field: { kind: "select", options: ["No travel", "Occasionally (up to 25%)", "Up to 50%", "More than 50%"] } },
  { key: "job_change_reason", category: "preferences", question: "Reason for job change", aliases: ["reason for change", "reason for leaving", "why are you leaving", "why change", "reason for job change", "why are you looking"], long_form: true, help: "Keep it positive: what you're looking for next" },

  // ── Education
  { key: "highest_degree", category: "education", question: "Highest degree", aliases: ["degree", "highest degree", "highest qualification", "education level", "qualification"],
    field: { kind: "select", options: ["High school", "Diploma", "Bachelor's degree", "Master's degree", "MBA", "PhD"] } },
  { key: "field_of_study", category: "education", question: "Field of study", aliases: ["field of study", "major", "discipline", "specialization", "branch"], hint: "Interaction design",
    field: { kind: "combo", options: ["Design", "Interaction design", "Communication design", "Industrial design", "Human-computer interaction", "Computer science", "Information technology", "Psychology", "Fine arts", "Architecture", "Engineering", "Business"] } },
  { key: "university", category: "education", question: "College / university", aliases: ["university", "college", "school", "institution", "institute"], hint: "National Institute of Design" },
  { key: "graduation_year", category: "education", question: "Graduation year", aliases: ["graduation year", "year of graduation", "passing year", "year of passing", "graduation date"], field: { kind: "select", options: YEARS } },
  { key: "cgpa", category: "education", question: "CGPA or percentage", aliases: ["cgpa", "gpa", "grade", "percentage", "marks", "score"], hint: "8.4/10 or 78%" },
  { key: "class_12", category: "education", question: "Class 12 percentage", aliases: ["12th", "class 12", "xii", "higher secondary", "hsc"], hint: "85", field: { kind: "number", unit: "%", step: 0.1, min: 0, max: 100 } },
  { key: "class_10", category: "education", question: "Class 10 percentage", aliases: ["10th", "class 10", "ssc", "secondary"], hint: "90", field: { kind: "number", unit: "%", step: 0.1, min: 0, max: 100 } },

  // ── Work authorization
  { key: "auth_india", category: "authorization", question: "Authorized to work in India?", aliases: ["authorized to work in india", "eligible to work in india", "work in india"], field: yesNo },
  { key: "auth_us", category: "authorization", question: "Authorized to work in the US?", aliases: ["authorized to work in the united states", "authorized to work in the us", "legally authorized", "eligible to work", "work authorization", "right to work"], field: yesNo },
  { key: "sponsorship", category: "authorization", question: "Need visa sponsorship, now or later?", aliases: ["sponsorship", "visa sponsorship", "require sponsorship", "need sponsorship", "h-1b", "h1b", "visa"], field: yesNo },
  { key: "passport", category: "authorization", question: "Have a valid passport?", aliases: ["passport"], field: yesNo },
  { key: "nationality", category: "authorization", question: "Nationality", aliases: ["nationality", "citizenship", "citizen"], hint: "Indian", field: { kind: "combo", options: NATIONALITIES } },

  // ── Screening
  { key: "heard_about", category: "screening", question: "How did you hear about the role? (default)", aliases: ["how did you hear", "where did you hear", "source", "how did you find", "referral source"],
    field: { kind: "select", options: ["LinkedIn", "Company website", "Employee referral", "Recruiter reached out", "Naukri", "Instahyre", "Wellfound", "Indeed", "Friend or colleague", "Other"] } },
  { key: "referred", category: "screening", question: "Referrer's name", aliases: ["referred", "referral", "referrer", "employee referral", "who referred you"], help: "Leave empty if you weren't referred" },
  { key: "worked_before", category: "screening", question: "Worked at the company before?", aliases: ["worked here before", "previously employed", "former employee", "worked for us", "ever been employed by"], field: yesNo },
  { key: "applied_before", category: "screening", question: "Applied there before?", aliases: ["applied before", "previously applied"], field: yesNo },
  { key: "relatives", category: "screening", question: "Relatives working there?", aliases: ["relatives", "relative", "family member employed", "related to any employee"], field: yesNo },
  { key: "over_18", category: "screening", question: "18 or older?", aliases: ["18 years", "over 18", "at least 18", "of legal age"], field: yesNo },
  { key: "background_check", category: "screening", question: "OK with a background check?", aliases: ["background check", "background verification", "bgv"], field: yesNo },
  { key: "non_compete", category: "screening", question: "Bound by a non-compete or bond?", aliases: ["non-compete", "non compete", "bond", "restrictive covenant"], field: yesNo },

  // ── EEO (mostly US forms; the wording matches what they offer)
  { key: "gender", category: "eeo", question: "Gender", aliases: ["gender", "sex"], field: { kind: "select", options: ["Female", "Male", "Non-binary", DECLINE] } },
  { key: "ethnicity", category: "eeo", question: "Race / ethnicity", aliases: ["race", "ethnicity", "ethnic"],
    field: { kind: "select", options: ["Asian", "Black or African American", "Hispanic or Latino", "White", "Native Hawaiian or Other Pacific Islander", "American Indian or Alaska Native", "Two or more races", DECLINE] } },
  { key: "veteran", category: "eeo", question: "Veteran status", aliases: ["veteran", "military", "protected veteran"],
    field: { kind: "select", options: ["I am not a protected veteran", "I identify as one or more of the classifications of protected veteran", "I don't wish to answer"] } },
  { key: "disability", category: "eeo", question: "Disability status", aliases: ["disability", "disabled", "handicap"],
    field: { kind: "select", options: ["No, I do not have a disability", "Yes, I have a disability (or previously had one)", "I do not wish to answer"] } },
  { key: "orientation", category: "eeo", question: "Sexual orientation", aliases: ["sexual orientation", "lgbtq"],
    field: { kind: "select", options: ["Heterosexual", "Gay or lesbian", "Bisexual", "Queer", "Asexual", DECLINE] } },

  // ── Long answers (AI adapts these per job)
  { key: "summary", category: "long", question: "Professional summary / about me", aliases: ["summary", "about you", "about yourself", "tell us about yourself", "introduce yourself", "professional summary", "bio"], long_form: true },
  { key: "why_company", category: "long", question: "Why do you want to work here? (base answer)", aliases: ["why do you want", "why are you interested", "why this company", "why us", "what interests you", "why join", "motivation"], long_form: true },
  { key: "why_role", category: "long", question: "Why are you a good fit for this role?", aliases: ["why are you a good fit", "why should we hire", "what makes you", "fit for this role", "why this role"], long_form: true },
  { key: "achievement", category: "long", question: "Proudest professional achievement", aliases: ["achievement", "proud", "accomplishment", "impact you"], long_form: true },
  { key: "strengths", category: "long", question: "Greatest strengths", aliases: ["strength", "strengths"], long_form: true },
  { key: "design_process", category: "long", question: "Describe your design process", aliases: ["design process", "how do you approach", "approach to design"], long_form: true },
  { key: "case_study", category: "long", question: "Walk us through a project you're proud of", aliases: ["case study", "walk us through", "favorite project", "project you are proud"], long_form: true },
  { key: "collaboration", category: "long", question: "How do you work with PMs and engineers?", aliases: ["collaborate", "cross-functional", "work with engineers", "work with product managers"], long_form: true },
  { key: "hard_problem", category: "long", question: "Hardest problem you solved", aliases: ["hardest problem", "technical challenge", "difficult bug"], long_form: true },
  { key: "cover_letter", category: "long", question: "Cover letter (base template)", aliases: ["cover letter", "covering letter", "additional information", "anything else", "message to the hiring"], long_form: true },
];

/** Questions from older versions that are no longer shown (answers are kept). */
export const RETIRED_KEYS = new Set(["leetcode","frameworks","system_design","google_scholar","kaggle","huggingface","ml_frameworks","ml_areas","mlops","publications","ml_production","cloud_devops"]);
