# SkillSync: Intelligent Resume Shortlister & Analyzer 🚀

![NodeJS](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Google Gemini](https://img.shields.io/badge/Google_Gemini-8E75B2?style=for-the-badge&logo=googlegemini&logoColor=white)
![Brevo](https://img.shields.io/badge/Brevo_API-0092FF?style=for-the-badge&logo=brevo&logoColor=white)
![Status](https://img.shields.io/badge/Status-Live-success?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)

SkillSync is an AI-driven recruitment platform that eliminates manual screening bias by intelligently scoring and ranking candidates against complex job descriptions. By leveraging **Gemini Pro** for semantic analysis and the **Brevo API** for automated candidate engagement, SkillSync reduces shortlisting time by up to 90%.

---

## 🏆 Achievements
- **First Place** | Project Exhibition 2026 @ Bangalore Technological Institute.
- **Best Paper Award** | Smartworld 2025 Third International Conference.

---

## 📊 System Architecture
SkillSync follows a modular backend architecture to ensure low latency during heavy batch processing of PDFs.


---

## ✨ Core Functionalities
- **Semantic Analysis:** Uses LLM-based intent recognition instead of simple keyword matching to identify synonyms and related skills.
- **Batch Processing:** Simultaneously analyzes multiple `.pdf` or `.docx` files using automated buffers.
- **Automated Feedback Loop:** Generates personalized reports and emails them instantly via the **Brevo API**.
- **Customizable Weighting:** Allows recruiters to prioritize specific criteria like Education, Experience, or Certifications.

---

## 📁 Repository Structure
```text
ATS ANALYZER/
├── config/             # Environment & Weighting configurations
├── lib/                # Core logic (eligibility.js, mailer.js)
├── public/             # Optimized frontend (HTML/CSS/Vanilla JS)
├── tools/              # PDF parsing and utility scripts
├── server.js           # Express.js entry point & API orchestration
└── .env.example        # Reference for required secrets

🛠️ Tech Stack
- **Backend:** Node.js, Express.js
- **AI Engine:** Google Gemini API
- **Email Service:** Brevo (formerly Sendinblue) API
- **Frontend:** HTML5, CSS3, JavaScript (Vanilla)

🚀 Getting Started

1. Clone the Repo
git clone [https://github.com/Santhu-017/SkillSync.git](https://github.com/Santhu-017/SkillSync.git)
cd SkillSync

2. Install Dependencies
Bash:
npm install

3. Setup Environment Variables
Create a .env file in the root directory:
Code snippet:
PORT=3000
GEMINI_API_KEY=your_gemini_key_here
BREVO_API_KEY=your_brevo_key_here

4. Run the App
Bash:
npm start

👥 Team SkillSync
Santhosh A S (Team Lead)
S M Prajwal
Vikas J P
Praveen Kumar P
