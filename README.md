# Step 1: Navigate to the server directory
cd server

# Step 2: Install server dependencies
npm install


# Step 3: Set up the PostgreSQL database
# Run the SQL commands in db-setup.sql to create the necessary tables
If not already installed, download and install PostgreSQL from postgresql.org. During installation, note the password you set for the postgres user and ensure the PostgreSQL bin directory (e.g., C:\Program Files\PostgreSQL\<version>\bin on Windows) is added to your system PATH.
psql --version

Open a terminal and connect to PostgreSQL as the postgres user:
psql -U postgres
CREATE DATABASE lovable-thoughts;
\q
psql -U postgres -d lovable-thoughts -f server/db-setup.sql
psql -U postgres -d lovable-thoughts
\dt
\q


# Step 4: Configure environment variables
# Create a .env file in the server directory with your PostgreSQL and Firebase configuration
# Open server/.env and add the following lines, replacing placeholders with your actual values:
touch .env
PG_USER=postgres
PG_PASSWORD=your-postgres-password
PG_HOST=localhost
PG_PORT=5432
PG_DATABASE=lovable-thoughts

# Save the JSON file as server/firebase-service-account.json and add its path to .env
FIREBASE_ADMIN_KEY_PATH=./firebase-service-account.json

Ensure firebase-service-account.json is added to .gitignore to prevent accidental commits.Ensure firebase-service-account.json is added to .gitignore to prevent accidental commits.

# Step 5: Start the server
npm run dev
