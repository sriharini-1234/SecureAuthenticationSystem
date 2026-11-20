# Secure Authentication System

A full-stack authentication demo with a React frontend, ASP.NET Core Web API, and MySQL database. It supports account registration, CAPTCHA-checked login, session management, profile access, logout, and password recovery.

> **Development project:** The CAPTCHA answer is returned by the API for the demo, and password recovery can return a development OTP when SMTP is not configured in the Development environment. Do not deploy these behaviors as a production authentication system without replacing or hardening them.

## Project Overview

The React application calls the ASP.NET Core API. The API stores users and refresh-session records in MySQL, hashes account passwords with BCrypt, issues JWT access tokens, and uses an HTTP-only cookie for refresh tokens.

## Key Features

- Register an account with a numeric user ID, email, mobile number, and password.
- CAPTCHA-protected login. The current demo API returns the CAPTCHA text to the frontend.
- JWT access tokens and refresh sessions, including a “keep me signed in” option.
- Authenticated profile page and logout.
- Password reset with an emailed one-time code when SMTP is configured.
- Development-only password-reset code response when running in Development with SMTP entirely unconfigured.
- Swagger UI for exploring and making API requests.

## Technologies Used

| Area | Technology |
|---|---|
| Backend | ASP.NET Core Web API, .NET 10 (`net10.0`) |
| Data access | Entity Framework Core with Pomelo MySQL provider |
| Database driver | MySqlConnector |
| Database | MySQL |
| Authentication | JWT Bearer, `System.IdentityModel.Tokens.Jwt`, BCrypt.Net-Next |
| API documentation | Swashbuckle / Swagger |
| Frontend | React 18, JavaScript, Vite 6 |
| Routing and HTTP | React Router 6, Axios |

The backend package versions are listed in `backend/SecureAuthAPI/SecureAuthAPI.csproj`; frontend dependencies and scripts are listed in `frontend/secure-auth-ui/package.json`.

## Project Folder Structure

Generated folders such as `node_modules`, `bin`, `obj`, and `dist` are omitted.

```text
SecureAuthenticationSystem/
├── README.md
├── SecureAuthenticationSystem.code-workspace
├── package-lock.json                 # Root lockfile; there is no root package.json
├── backend/
│   └── SecureAuthAPI/
│       ├── Controllers/
│       │   ├── AuthController.cs
│       │   └── PasswordController.cs
│       ├── Properties/
│       │   └── launchSettings.json
│       ├── Program.cs
│       ├── SecureAuthAPI.csproj
│       └── appsettings.json
└── frontend/
    ├── .env                          # VITE_API_URL is present here; see environment notes
    └── secure-auth-ui/
        ├── index.html
        ├── package.json
        ├── package-lock.json
        ├── vite.config.js
        └── src/
            ├── api.js
            ├── App.jsx
            ├── main.jsx
            └── style.css
```

Vite is run from `frontend/secure-auth-ui`, so put a project-specific `.env` file there (or set `VITE_API_URL` in the frontend terminal). The existing `frontend/.env` is in the parent directory and is not Vite's default project-root env file.

## System Requirements

- .NET 10 SDK.
- Node.js 18 or newer and npm.
- A running MySQL server reachable from the backend.
- PowerShell on Windows (commands below use PowerShell syntax).

## Installation and Setup

1. Clone or download the repository and open a terminal at the project root.
2. Install/restore dependencies:

   ```powershell
   Set-Location .\backend\SecureAuthAPI
   dotnet restore
   ```

   In a second terminal:

   ```powershell
   Set-Location .\frontend\secure-auth-ui
   npm ci
   ```

3. Configure MySQL and the backend settings described below.
4. Start the backend and frontend in separate terminals as described in [How to Run the Application](#how-to-run-the-application).

## Environment Variables Configuration

The backend reads these .NET configuration keys. Environment variables use double underscores (`__`) in place of configuration colons (`:`). `appsettings.json` currently contains local configuration values; do not copy credentials or signing keys into this README or commit real secrets.

| Environment variable | Purpose |
|---|---|
| `ConnectionStrings__DefaultConnection` | MySQL connection string for the `SecureAuthDB` database. A connection string is also configured in `appsettings.json`; override it locally as needed. |
| `Jwt__Key` | JWT signing key. Keep it private and use a strong, unique value. |
| `Jwt__Issuer` | Expected JWT issuer. Must match the value used when issuing tokens. |
| `Jwt__Audience` | Expected JWT audience. Must match the value used when issuing tokens. |
| `ASPNETCORE_ENVIRONMENT` | Controls Development-only behavior. The provided HTTP launch profile sets this to `Development`. |
| `Email__SmtpHost` | SMTP server hostname. |
| `Email__From` | Sender email address. |
| `Email__SmtpPort` | SMTP port; defaults to `587` when omitted. |
| `Email__EnableSsl` | Enables TLS; defaults to `true` when omitted. |
| `Email__SmtpUsername` | Optional SMTP username. Set together with the password, or omit both. |
| `Email__SmtpPassword` | Optional SMTP password/app password. Set together with the username; never commit it. |
| `VITE_API_URL` | Optional frontend API base URL. Defaults to `http://localhost:5000/api`. |

For local development, set backend variables in the same PowerShell terminal that starts the backend. Replace each placeholder locally; do not use real credentials in a committed file:

```powershell
$env:ConnectionStrings__DefaultConnection = "server=localhost;port=3306;database=SecureAuthDB;user=YOUR_MYSQL_USER;password=YOUR_LOCAL_PASSWORD"
$env:Jwt__Key = "REPLACE_WITH_A_PRIVATE_RANDOM_SIGNING_KEY"
$env:Jwt__Issuer = "SecureAuthAPI"
$env:Jwt__Audience = "SecureAuthReact"
$env:ASPNETCORE_ENVIRONMENT = "Development"
```

To send reset codes by email, configure the SMTP settings too. Set both SMTP credentials or neither:

```powershell
$env:Email__SmtpHost = "smtp.example.com"
$env:Email__SmtpPort = "587"
$env:Email__EnableSsl = "true"
$env:Email__From = "your-sender@example.com"
$env:Email__SmtpUsername = "YOUR_SMTP_USERNAME"
$env:Email__SmtpPassword = "YOUR_SMTP_APP_PASSWORD"
```

For the frontend, set the API URL before starting Vite if the API is not at its default address:

```powershell
$env:VITE_API_URL = "http://localhost:5000/api"
```

The Vite server is configured for port `5173`. The backend CORS policy currently allows the local frontend origins on ports `5173` and `5174`, using either `localhost` or `127.0.0.1`.

## Database Setup

1. Start MySQL and create the database if it does not already exist:

   ```sql
   CREATE DATABASE SecureAuthDB;
   ```

2. Ensure `ConnectionStrings__DefaultConnection` (or `ConnectionStrings:DefaultConnection` in local configuration) points to this database and uses credentials with permission to create tables and write data.
3. On startup, the API calls EF Core `EnsureCreatedAsync()` to create the schema if needed. This project does not currently include EF Core migrations.
4. If the `Users` table is empty, the API inserts a development seed account. **This seed is not environment-gated in the current code; remove or guard it before production use.**

### Data Models

- `AppUser`: integer database ID, unique string user ID, BCrypt password hash, email, mobile number, active flag, and UTC creation time.
- `UserSession`: the numeric `AppUser.Id` value, unique refresh-token hash, creation/expiry/last-activity timestamps, and revoked flag.

The API defines unique indexes for `AppUser.UserId` and `UserSession.RefreshTokenHash`. No explicit EF foreign-key or navigation relationship is configured between these entities.

## How to Run the Application

Run the backend and frontend in separate terminals from the repository root.

### Terminal 1: Backend API

```powershell
Set-Location .\backend\SecureAuthAPI
dotnet run
```

The provided launch profile listens at `http://localhost:5000` and sets the environment to Development. Keep this terminal open while using the app.

- Backend home: [http://localhost:5000/](http://localhost:5000/)
- Swagger UI: [http://localhost:5000/swagger](http://localhost:5000/swagger)

### Terminal 2: React frontend

```powershell
Set-Location .\frontend\secure-auth-ui
npm run dev -- --host 127.0.0.1
```

Open the `Local` URL printed by Vite (normally [http://127.0.0.1:5173/](http://127.0.0.1:5173/)). If the port is occupied, Vite may choose another port. The backend CORS policy allows ports 5173 and 5174; for any other port, update the CORS origins in `Program.cs` and restart the API.

Stop either development server with **Ctrl+C** in its terminal. Do not start a second backend instance while another process is already using port 5000.

### Frontend scripts

Run these commands from `frontend/secure-auth-ui`:

| Command | Purpose |
|---|---|
| `npm run dev` | Start the Vite development server. |
| `npm run build` | Create the production frontend bundle in `dist/`. |
| `npm run preview` | Preview the production bundle locally. |

There is no `test` script in `package.json`.

## API Documentation and Endpoints

Swagger UI is available at `http://localhost:5000/swagger` while the backend is running. JSON request bodies use `Content-Type: application/json`.

To authorize the protected profile operation in Swagger:

1. Call `GET /api/Auth/captcha` and note the returned `captchaId` and `captchaText`.
2. Call `POST /api/Auth/login` with the account credentials and CAPTCHA values.
3. Copy `accessToken` from the login response, click **Authorize** in Swagger, and paste the token without adding the `Bearer ` prefix.
4. Call `GET /api/Auth/profile`; Swagger will send the Bearer token. The lock icon is shown only for this `[Authorize]` endpoint.

`POST /api/Auth/logout` does not use Bearer authorization; it revokes the refresh session from the HTTP-only cookie when one is present.

| Method | Endpoint | Request | Success response | Other behavior |
|---|---|---|---|---|
| `GET` | `/api/auth/captcha` | None | `200`: `{ "captchaId", "captchaText", "expiresInMinutes" }` | CAPTCHA expires in 5 minutes. Text is returned to the browser for demo purposes only. |
| `POST` | `/api/auth/register` | `{ "userId", "password", "email", "mobileNumber" }` | `201`: `{ "message", "userId" }` | User ID must be 1–20 digits; password must be at least 8 characters and at most 72 UTF-8 bytes; email must be valid; mobile number is required. `400` for invalid fields; `409` if the user ID already exists. |
| `POST` | `/api/auth/login` | `{ "userId", "password", "captchaId", "captchaText", "rememberMe" }` | `200`: `{ "accessToken", "expiresInMinutes", "user": { "userId", "email", "mobileNumber" } }` | Also sets an HTTP-only refresh cookie. `400` for invalid ID/CAPTCHA; `401` for invalid credentials. |
| `POST` | `/api/auth/refresh` | None; uses the refresh cookie | `200`: `{ "accessToken", "expiresInMinutes" }` | `401` if the refresh session is missing, expired, revoked, or timed out. |
| `GET` | `/api/auth/profile` | `Authorization: Bearer <access-token>` | `200`: `{ "userId", "email", "mobileNumber" }` | Requires a valid access token; otherwise `401`. |
| `POST` | `/api/auth/logout` | None; uses the refresh cookie if present | `200`: `{ "message" }` | Revokes the refresh session when found and clears the cookie. |
| `POST` | `/api/password/forgot` | `{ "userId" }` | `200`: `{ "message" }` | In Development with SMTP entirely unconfigured, includes `developmentOtp`; SMTP configuration/send failures return `503`. The response does not disclose whether an unknown user ID exists. |
| `POST` | `/api/password/reset` | `{ "userId", "otp", "newPassword" }` | `200`: `{ "message" }` | `400` for an invalid/expired code or a new password shorter than 8 characters; revokes active refresh sessions. |

Example registration request:

```json
{
  "userId": "YOUR_NUMERIC_USER_ID",
  "password": "YOUR_LOCAL_PASSWORD",
  "email": "you@example.com",
  "mobileNumber": "YOUR_MOBILE_NUMBER"
}
```

## Authentication and Authorization

- Login verifies the CAPTCHA and BCrypt password hash, then returns a JWT access token that expires after 15 minutes.
- The frontend stores the access token in browser `localStorage` and sends it as a Bearer token to the protected profile endpoint.
- A refresh token is sent in an HTTP-only cookie and stored in the database only as a SHA-256 hash.
- With **Keep me signed in** selected, the refresh session may last up to 30 days. Otherwise it may last up to 1 day and is revoked after 15 minutes of inactivity.
- Password reset changes the BCrypt hash and revokes existing refresh sessions.
- The current implementation has no roles or role-based authorization.

## Screenshots

No screenshots are currently included in the repository.

## Testing Instructions

There is no backend test project and no frontend test script in the current project.

Available verification commands:

```powershell
# Backend build
Set-Location .\backend\SecureAuthAPI
dotnet build

# Frontend production build
Set-Location ..\..\frontend\secure-auth-ui
npm run build
```

For manual API testing, open Swagger and try the CAPTCHA, registration, login, profile, logout, and password-reset endpoints. The profile request requires a Bearer access token; login and refresh also use the HTTP-only refresh cookie as described above.

## Sample Login Credentials

No sample password is published in this README. The backend seeds an account when the `Users` table is empty; for a new account, use **Create an account** in the frontend. The seed behavior should be removed or restricted to local development before deployment.

## Future Enhancements

These are not implemented currently:

- Replace the demo CAPTCHA with a production CAPTCHA provider.
- Add rate limiting, account lockout, audit logging, and security monitoring.
- Add email verification during registration.
- Replace `EnsureCreated` with versioned EF Core migrations.
- Add automated backend and frontend tests.
- Move access tokens out of `localStorage` if the chosen security design requires it, and add CSRF protections appropriate to cookie-based authentication.
- Add roles/permissions if the application requires them.

## Author Information

Author information is not specified in the project files. Add your preferred name, organization, or contact details here.

## License

No `LICENSE` file is present. Add a license before publishing the repository if you want to grant users explicit reuse rights.
