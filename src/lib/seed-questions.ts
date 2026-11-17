// Default questions seeded into your Answers bank on first login.
// `aliases` are phrases the Chrome extension looks for in a form field's
// label / placeholder / name to decide which answer to fill.

export const TRACKS = [
  { id: "product_designer", label: "Product Designer", blurb: "Portfolio, case studies, design process and tools" },
  { id: "software_engineer", label: "Software Engineer", blurb: "GitHub, tech stack, systems you've built" },
  { id: "ml_engineer", label: "ML Engineer", blurb: "Publications, models, frameworks, ML in production" },
  { id: "other", label: "Other", blurb: "Only the common questions" },
] as const;

export type Track = (typeof TRACKS)[number]["id"];

export type SeedQuestion = {
  key: string;
  category: Category;
  question: string;
  aliases: string[];
  long_form?: boolean;
  hint?: string;
  /** Only shown for these career tracks. Omitted = every track. */
  tracks?: Track[];
};

/** Is this question part of the given track? Custom questions always are. */
export function inTrack(key: string, track: Track) {
  const q = SEED_QUESTIONS.find((x) => x.key === key);
  return !q || !q.tracks || q.tracks.includes(track);
}

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

export const SEED_QUESTIONS: SeedQuestion[] = [
  // ── Personal & contact
  { key: "full_name", category: "personal", question: "Full name", aliases: ["full name", "your name", "legal name", "candidate name", "name"] },
  { key: "first_name", category: "personal", question: "First name", aliases: ["first name", "given name", "firstname", "fname"] },
  { key: "last_name", category: "personal", question: "Last name", aliases: ["last name", "surname", "family name", "lastname", "lname"] },
  { key: "preferred_name", category: "personal", question: "Preferred name", aliases: ["preferred name", "preferred first name", "nickname"] },
  { key: "email", category: "personal", question: "Email", aliases: ["email", "e-mail", "email address"] },
  { key: "phone", category: "personal", question: "Phone number (with country code)", aliases: ["phone", "mobile", "contact number", "phone number", "telephone", "cell"], hint: "+91 98xxxxxxx" },
  { key: "phone_country_code", category: "personal", question: "Phone country code", aliases: ["country code", "dial code", "phone country"], hint: "+91" },
  { key: "city", category: "personal", question: "Current city", aliases: ["city", "current city", "current location", "location city", "where are you based", "location"], hint: "Bengaluru" },
  { key: "state", category: "personal", question: "State", aliases: ["state", "province", "region"] },
  { key: "country", category: "personal", question: "Country", aliases: ["country", "country of residence"] },
  { key: "postal_code", category: "personal", question: "PIN / postal code", aliases: ["postal code", "zip", "pin code", "pincode", "zip code"] },
  { key: "address", category: "personal", question: "Full address", aliases: ["address", "street address", "address line 1", "residential address"] },
  { key: "pronouns", category: "personal", question: "Pronouns", aliases: ["pronouns"] },
  { key: "date_of_birth", category: "personal", question: "Date of birth", aliases: ["date of birth", "dob", "birth date"], hint: "Only some Indian forms ask this" },

  // ── Links
  { key: "linkedin", category: "links", question: "LinkedIn profile URL", aliases: ["linkedin", "linkedin profile", "linkedin url"] },
  { key: "github", category: "links", question: "GitHub URL", aliases: ["github", "github profile", "github url"], tracks: ["software_engineer", "ml_engineer"] },
  { key: "portfolio", category: "links", question: "Portfolio / personal website", aliases: ["portfolio", "website", "personal website", "personal site", "blog", "other website"] },
  { key: "other_link", category: "links", question: "Other profile link", aliases: ["other link", "other profile", "twitter", "x profile"] },

  // ── Product Designer
  { key: "portfolio_password", category: "links", question: "Portfolio password (if protected)", aliases: ["portfolio password", "password for portfolio"], tracks: ["product_designer"] },
  { key: "dribbble", category: "links", question: "Dribbble URL", aliases: ["dribbble"], tracks: ["product_designer"] },
  { key: "behance", category: "links", question: "Behance URL", aliases: ["behance"], tracks: ["product_designer"] },
  { key: "design_tools", category: "craft", question: "Design tools you use", aliases: ["design tools", "tools", "software proficiency", "figma"], hint: "Figma, FigJam, Framer, ProtoPie, Jira", tracks: ["product_designer"] },
  { key: "design_focus", category: "craft", question: "Design focus", aliases: ["design focus", "specialization", "area of expertise"], hint: "Product / UX / interaction / visual / research", tracks: ["product_designer"] },
  { key: "research_methods", category: "craft", question: "Research methods you've used", aliases: ["research methods", "user research", "usability testing"], hint: "Interviews, usability tests, surveys, A/B tests", tracks: ["product_designer"] },
  { key: "design_systems", category: "craft", question: "Design systems experience", aliases: ["design system", "component library"], tracks: ["product_designer"] },
  { key: "shipped_products", category: "craft", question: "Products you've shipped (with links)", aliases: ["shipped", "products you have worked on", "live products"], tracks: ["product_designer"] },
  { key: "design_process", category: "long", question: "Describe your design process", aliases: ["design process", "how do you approach", "approach to design"], long_form: true, tracks: ["product_designer"] },
  { key: "case_study", category: "long", question: "Walk us through a project you're proud of", aliases: ["case study", "walk us through", "favorite project", "project you are proud"], long_form: true, tracks: ["product_designer"] },
  { key: "collaboration", category: "long", question: "How do you work with PMs and engineers?", aliases: ["collaborate", "cross-functional", "work with engineers", "work with product managers"], long_form: true, tracks: ["product_designer"] },

  // ── Software Engineer
  { key: "leetcode", category: "links", question: "LeetCode / competitive programming profile", aliases: ["leetcode", "codeforces", "hackerrank", "codechef"], tracks: ["software_engineer"] },
  { key: "languages_code", category: "craft", question: "Programming languages", aliases: ["programming languages", "languages you code", "coding languages"], hint: "TypeScript, Go, Python", tracks: ["software_engineer", "ml_engineer"] },
  { key: "frameworks", category: "craft", question: "Frameworks & libraries", aliases: ["frameworks", "libraries", "tech stack"], hint: "React, Next.js, Node, Spring", tracks: ["software_engineer"] },
  { key: "cloud_devops", category: "craft", question: "Cloud & DevOps", aliases: ["cloud", "devops", "aws", "gcp", "azure", "kubernetes", "docker"], tracks: ["software_engineer", "ml_engineer"] },
  { key: "open_source", category: "craft", question: "Open-source contributions", aliases: ["open source", "oss contributions"], tracks: ["software_engineer", "ml_engineer"] },
  { key: "system_design", category: "long", question: "Describe a system you designed or scaled", aliases: ["system you designed", "architecture", "scale", "system design"], long_form: true, tracks: ["software_engineer"] },
  { key: "hard_problem", category: "long", question: "Hardest technical problem you solved", aliases: ["hardest problem", "technical challenge", "difficult bug"], long_form: true, tracks: ["software_engineer", "ml_engineer"] },

  // ── ML Engineer
  { key: "google_scholar", category: "links", question: "Google Scholar profile", aliases: ["google scholar", "scholar"], tracks: ["ml_engineer"] },
  { key: "kaggle", category: "links", question: "Kaggle profile", aliases: ["kaggle"], tracks: ["ml_engineer"] },
  { key: "huggingface", category: "links", question: "Hugging Face profile", aliases: ["hugging face", "huggingface"], tracks: ["ml_engineer"] },
  { key: "ml_frameworks", category: "craft", question: "ML frameworks", aliases: ["ml frameworks", "pytorch", "tensorflow", "jax"], hint: "PyTorch, JAX, scikit-learn", tracks: ["ml_engineer"] },
  { key: "ml_areas", category: "craft", question: "ML areas", aliases: ["ml areas", "domain", "nlp", "computer vision", "llm", "recommender"], hint: "LLMs, NLP, CV, recommender systems", tracks: ["ml_engineer"] },
  { key: "mlops", category: "craft", question: "MLOps & data tooling", aliases: ["mlops", "mlflow", "airflow", "spark", "data pipelines"], tracks: ["ml_engineer"] },
  { key: "publications", category: "long", question: "Publications / papers", aliases: ["publications", "papers", "research papers"], long_form: true, tracks: ["ml_engineer"] },
  { key: "ml_production", category: "long", question: "ML systems you've put in production", aliases: ["production", "deployed models", "ml in production"], long_form: true, tracks: ["ml_engineer"] },

  // ── Current role & compensation
  { key: "current_company", category: "work", question: "Current / most recent company", aliases: ["current company", "current employer", "most recent employer", "company name", "employer"] },
  { key: "current_title", category: "work", question: "Current / most recent job title", aliases: ["current title", "current job title", "current designation", "designation", "current role", "job title"] },
  { key: "total_experience", category: "work", question: "Total years of experience", aliases: ["total experience", "years of experience", "how many years", "total years", "work experience years", "experience in years"], hint: "e.g. 4" },
  { key: "relevant_experience", category: "work", question: "Relevant years of experience", aliases: ["relevant experience", "years of relevant experience", "experience in this field"] },
  { key: "current_ctc", category: "work", question: "Current CTC (annual)", aliases: ["current ctc", "current salary", "current compensation", "current annual", "present salary", "current package"], hint: "e.g. 18 LPA (15 fixed + 3 variable)" },
  { key: "expected_ctc", category: "work", question: "Expected CTC (annual)", aliases: ["expected ctc", "expected salary", "salary expectation", "desired salary", "expected compensation", "compensation expectation"], hint: "e.g. 26 LPA, negotiable" },
  { key: "skills", category: "work", question: "Key skills (comma-separated)", aliases: ["skills", "key skills", "technical skills", "core skills", "tech stack"] },
  { key: "languages", category: "work", question: "Languages you speak", aliases: ["languages", "languages spoken", "language proficiency"] },

  // ── Availability & preferences
  { key: "notice_period", category: "preferences", question: "Notice period", aliases: ["notice period", "notice", "how soon can you join", "joining time"], hint: "e.g. 30 days / Immediate" },
  { key: "serving_notice", category: "preferences", question: "Currently serving notice? Last working day?", aliases: ["serving notice", "last working day", "lwd"] },
  { key: "start_date", category: "preferences", question: "Earliest start date", aliases: ["start date", "earliest start", "available to start", "date available", "availability", "when can you start"] },
  { key: "relocate", category: "preferences", question: "Open to relocation?", aliases: ["relocate", "relocation", "willing to relocate", "open to relocation"], hint: "Yes / No" },
  { key: "preferred_locations", category: "preferences", question: "Preferred work locations", aliases: ["preferred location", "preferred locations", "location preference", "which location"] },
  { key: "work_mode", category: "preferences", question: "Work mode preference (remote / hybrid / onsite)", aliases: ["remote", "hybrid", "onsite", "on-site", "work from office", "work mode", "work arrangement", "comfortable working from office"] },
  { key: "travel", category: "preferences", question: "Willing to travel? How much?", aliases: ["travel", "willing to travel"] },
  { key: "job_change_reason", category: "preferences", question: "Reason for job change", aliases: ["reason for change", "reason for leaving", "why are you leaving", "why change", "reason for job change", "why are you looking"], long_form: true },

  // ── Education
  { key: "highest_degree", category: "education", question: "Highest degree", aliases: ["degree", "highest degree", "highest qualification", "education level", "qualification"], hint: "e.g. B.Tech" },
  { key: "field_of_study", category: "education", question: "Field of study / major", aliases: ["field of study", "major", "discipline", "specialization", "branch"] },
  { key: "university", category: "education", question: "College / university", aliases: ["university", "college", "school", "institution", "institute"] },
  { key: "graduation_year", category: "education", question: "Graduation year", aliases: ["graduation year", "year of graduation", "passing year", "year of passing", "graduation date"] },
  { key: "cgpa", category: "education", question: "CGPA / percentage", aliases: ["cgpa", "gpa", "grade", "percentage", "marks", "score"] },
  { key: "class_12", category: "education", question: "Class 12 percentage", aliases: ["12th", "class 12", "xii", "higher secondary", "hsc"] },
  { key: "class_10", category: "education", question: "Class 10 percentage", aliases: ["10th", "class 10", "ssc", "secondary"] },

  // ── Work authorization
  { key: "auth_india", category: "authorization", question: "Legally authorized to work in India?", aliases: ["authorized to work in india", "eligible to work in india", "work in india"], hint: "Yes" },
  { key: "auth_us", category: "authorization", question: "Legally authorized to work in the US?", aliases: ["authorized to work in the united states", "authorized to work in the us", "legally authorized", "eligible to work", "work authorization", "right to work"] },
  { key: "sponsorship", category: "authorization", question: "Will you now or in future require visa sponsorship?", aliases: ["sponsorship", "visa sponsorship", "require sponsorship", "need sponsorship", "h-1b", "h1b", "visa"] },
  { key: "nationality", category: "authorization", question: "Nationality / citizenship", aliases: ["nationality", "citizenship", "citizen"] },
  { key: "passport", category: "authorization", question: "Do you hold a valid passport?", aliases: ["passport"] },

  // ── Screening
  { key: "heard_about", category: "screening", question: "How did you hear about this role?", aliases: ["how did you hear", "where did you hear", "source", "how did you find", "referral source"], hint: "LinkedIn" },
  { key: "referred", category: "screening", question: "Were you referred by an employee? (name)", aliases: ["referred", "referral", "referrer", "employee referral", "who referred you"] },
  { key: "worked_before", category: "screening", question: "Have you worked here before?", aliases: ["worked here before", "previously employed", "former employee", "worked for us", "ever been employed by"], hint: "No" },
  { key: "applied_before", category: "screening", question: "Have you applied here before?", aliases: ["applied before", "previously applied"], hint: "No" },
  { key: "relatives", category: "screening", question: "Any relatives working at the company?", aliases: ["relatives", "relative", "family member employed", "related to any employee"], hint: "No" },
  { key: "over_18", category: "screening", question: "Are you 18 or older?", aliases: ["18 years", "over 18", "at least 18", "of legal age"], hint: "Yes" },
  { key: "background_check", category: "screening", question: "OK with a background check?", aliases: ["background check", "background verification", "bgv"], hint: "Yes" },
  { key: "non_compete", category: "screening", question: "Bound by a non-compete / bond?", aliases: ["non-compete", "non compete", "bond", "restrictive covenant"], hint: "No" },

  // ── EEO
  { key: "gender", category: "eeo", question: "Gender", aliases: ["gender", "sex"], hint: "or: Decline to self-identify" },
  { key: "ethnicity", category: "eeo", question: "Race / ethnicity", aliases: ["race", "ethnicity", "ethnic"], hint: "Asian / Decline to self-identify" },
  { key: "veteran", category: "eeo", question: "Veteran status", aliases: ["veteran", "military", "protected veteran"], hint: "I am not a protected veteran" },
  { key: "disability", category: "eeo", question: "Disability status", aliases: ["disability", "disabled", "handicap"], hint: "No / Decline to answer" },
  { key: "orientation", category: "eeo", question: "Sexual orientation", aliases: ["sexual orientation", "lgbtq"], hint: "Decline to self-identify" },

  // ── Long answers (AI adapts these per job)
  { key: "summary", category: "long", question: "Professional summary / about me", aliases: ["summary", "about you", "about yourself", "tell us about yourself", "introduce yourself", "professional summary", "bio"], long_form: true },
  { key: "why_company", category: "long", question: "Why do you want to work here? (base answer)", aliases: ["why do you want", "why are you interested", "why this company", "why us", "what interests you", "why join", "motivation"], long_form: true },
  { key: "why_role", category: "long", question: "Why are you a good fit for this role?", aliases: ["why are you a good fit", "why should we hire", "what makes you", "fit for this role", "why this role"], long_form: true },
  { key: "achievement", category: "long", question: "Proudest professional achievement", aliases: ["achievement", "proud", "accomplishment", "impact you"], long_form: true },
  { key: "strengths", category: "long", question: "Greatest strengths", aliases: ["strength", "strengths"], long_form: true },
  { key: "cover_letter", category: "long", question: "Cover letter (base template)", aliases: ["cover letter", "covering letter", "additional information", "anything else", "message to the hiring"], long_form: true },
];
