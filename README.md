# FinanceFlow — AI-Powered Financial Reconciliation Platform

A full-stack financial data processing platform designed to simplify financial data ingestion, validation, reconciliation, and exception tracking. FinanceFlow aims to make financial data processing more flexible through AI-assisted column mapping and a modular backend architecture.

## Overview

Financial data often comes from multiple systems with inconsistent column names, missing records, duplicate transactions, and mismatched amounts. Processing these files manually can be time-consuming and error-prone.

FinanceFlow addresses these challenges through a centralized platform for processing financial datasets, validating records, identifying discrepancies, and supporting reconciliation workflows.

## Key Features

- **Financial Data Ingestion:** Upload CSV files containing financial records for processing.
- **AI-Powered Column Mapping:** Planned LangChain integration to suggest mappings between unfamiliar source columns and FinanceFlow's canonical fields.
- **Data Validation:** Identify missing values, invalid fields, duplicate records, and inconsistent financial data.
- **Transaction Reconciliation:** Compare financial records across sales, payment, and ledger datasets.
- **Exception Management:** Organize detected discrepancies for investigation and resolution.
- **Secure Authentication:** JWT-based authentication and role-based access control for ADMIN and ANALYST users.
- **Database Integration:** Store and manage structured financial data using PostgreSQL and SQLAlchemy.
- **Modular Backend:** Separate API, data-processing, validation, and reconciliation responsibilities.

> **Implementation note:** Update the AI mapping and multi-file upload descriptions to reflect their actual status as these features are implemented and tested.

## Technology Stack

| Category | Technologies |
|---|---|
| Frontend | Next.js, React, TypeScript |
| Backend | Python, FastAPI |
| Database | PostgreSQL |
| ORM | SQLAlchemy |
| Data Processing | Pandas |
| Authentication | JWT, role-based access control |
| AI Integration | LangChain, external LLM provider (planned) |
| Testing | Python unit and API tests |

## Architecture

```text
                    User
                     |
                     v
             Next.js Frontend
                     |
                     v
               FastAPI Backend
                     |
          +----------+----------+
          |          |          |
          v          v          v
       Ingestion  Validation  Authentication
          |          |
          v          v
        Data Processing
               |
               v
        Reconciliation
               |
          +----+----+
          |         |
          v         v
      PostgreSQL  Exceptions
```

The planned AI-assisted mapping layer will help translate differing source schemas into a consistent internal format before the existing validation and reconciliation logic runs.

## Reconciliation Workflow

1. Upload financial CSV data.
2. Inspect the source schema and required fields.
3. Map source columns to the expected fields, with AI assistance planned for unfamiliar schemas.
4. Validate transaction fields and references.
5. Match records across financial datasets.
6. Identify missing records, duplicates, and amount mismatches.
7. Record exceptions for further investigation.

## Project Structure

```text
FinanceFlow/
├── backend/
│   ├── api/
│   ├── processing/
│   ├── ingestion/
│   ├── services/
│   ├── security/
│   └── data/
├── frontend/
│   └── src/
│       └── app/
├── data/
│   └── synthetic/
├── tests/
├── DEPLOYMENT.md
└── README.md
```

*Directory names may vary slightly with the current implementation.*

## Getting Started

### Prerequisites

- Python 3.10 or a compatible version supported by the project dependencies
- Node.js and npm
- PostgreSQL
- Git

### 1. Clone the repository

```bash
git clone https://github.com/Preethi06121/FinanceFlow.git
cd FinanceFlow
```

### 2. Set up the backend

Create and activate a virtual environment:

```bash
python -m venv backend/venv
```

Windows PowerShell:

```powershell
.\backend\venv\Scripts\Activate.ps1
```

Install dependencies:

```bash
pip install -r backend/requirements.txt
```

### 3. Configure environment variables

Create a local environment file using the variable names expected by the backend configuration.

Typical settings may include:

```env
DATABASE_URL=your_postgresql_connection_string
JWT_SECRET_KEY=your_local_secret
```

Use the actual variable names defined in the project. Never commit real database credentials, secret keys, or API keys.

If an external LLM provider is configured, add its API key through the backend environment configuration.

### 4. Initialize the database

Create or configure a dedicated development database, then follow the database initialization instructions in the project.

**Do not point development or tests at a production database.**

### 5. Start the backend

Run the FastAPI application using the entry point configured in your repository. For example, if the application object is `app` in `main.py`:

```bash
uvicorn main:app --reload
```

Adjust the module path to match your actual backend entry point.

### 6. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Open the local URL displayed by Next.js in your terminal.

## Testing

Run the existing backend test suite from the directory expected by your project:

```bash
python -m unittest discover -s tests -v
```

Additional tests should cover transaction validation, duplicate detection, reconciliation correctness, authentication, malformed CSV files, and AI mapping responses.

Only report test counts or large-dataset benchmarks after reproducing them against the current codebase.

## Security Considerations

- Keep secrets in environment variables.
- Enforce authentication and role-based authorization on protected endpoints.
- Validate uploaded files and their contents.
- Use parameterized database operations through SQLAlchemy.
- Treat AI-generated mappings as suggestions that require validation.
- Avoid sending unnecessary sensitive financial data to external LLM providers.
- Use isolated test databases for automated testing.

## Future Improvements

- AI-assisted mapping for unfamiliar CSV schemas.
- Multi-file upload and coordinated ingestion.
- Batch processing for larger financial datasets.
- Improved reconciliation reporting and exception analytics.
- Expanded integration and performance testing.
- Additional data-quality insights and dashboards.

## Author

**Preethi Harshitha Koyye**

B.Tech, Computer Science and Engineering

GitHub: [Preethi06121](https://github.com/Preethi06121)

---

FinanceFlow is a software engineering project focused on financial data quality, reliable data processing, and extensible backend architecture.
