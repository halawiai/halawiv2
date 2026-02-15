## Social Login Setup (Microsoft, English)

### Get your Microsoft credentials

To use Microsoft as a social provider, you need to get your Microsoft credentials. You can get them by creating a new app in the [Microsoft Azure Portal](https://portal.azure.com/).

- In the Microsoft Azure Portal, go to **Azure Active Directory > App registrations**.
- Click **New registration**.
- Choose **Web** as the application type.
- In **Redirect URIs**, set:
  - For local development: `http://localhost:3000/api/auth/callback/microsoft`
  - For production: your deployed application's URL, e.g. `https://example.com/api/auth/callback/microsoft`
- If you change the base path of your authentication routes, update the redirect URL accordingly.
- Add your credentials to your `.env` file:

  ```text
  MICROSOFT_CLIENT_ID=your_client_id
  MICROSOFT_CLIENT_SECRET=your_client_secret
  MICROSOFT_TENANT_ID=your_tenant_id # Optional
  ```

## Environment Variable Check

Make sure your `.env` file contains the following variables:

```text
# Microsoft
MICROSOFT_CLIENT_ID=your_microsoft_client_id
MICROSOFT_CLIENT_SECRET=your_microsoft_client_secret
# Optional Tenant Id
MICROSOFT_TENANT_ID=your_microsoft_tenant_id
# Set to 1 to force account selection
MICROSOFT_FORCE_ACCOUNT_SELECTION=1
```

## Additional Configuration Options

### Authentication Settings

```text
# Disable email/password sign-in (optional)
DISABLE_EMAIL_SIGN_IN=1

# Disable new user sign-ups (optional)
DISABLE_SIGN_UP=1
```

### Base URL Configuration

For OAuth to work correctly, you must set the `BETTER_AUTH_URL` environment variable to match how you access the application:

```text
# For local development with HTTPS
BETTER_AUTH_URL=https://localhost:3000

# For local development with HTTP (default)
BETTER_AUTH_URL=http://localhost:3000

# For production
BETTER_AUTH_URL=https://yourdomain.com
```

**Important:** If you're using HTTPS locally (e.g., via a reverse proxy or custom SSL setup), make sure to set `BETTER_AUTH_URL=https://localhost:3000` to ensure OAuth callbacks work correctly.

## Done

You can now sign in using your Microsoft account. Restart the application to apply the changes.
