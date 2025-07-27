# Property Scraper with Google Sheets Integration

This project scrapes property listings from Redfin and automatically sends the data to Google Sheets.

## Features

- Scrapes Redfin property listings with retry logic
- Automatically sends data to Google Sheets
- Supports both creating new spreadsheets and updating existing ones
- Handles network errors and timeouts gracefully
- Auto-resizes columns for better readability

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Set up Google Sheets API

You have two options for authentication:

#### Option A: Service Account (Recommended)

1. **Create a Google Cloud Project:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one

2. **Enable Google Sheets API:**
   - In the Google Cloud Console, go to "APIs & Services" > "Library"
   - Search for "Google Sheets API" and enable it

3. **Create Service Account:**
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "Service Account"
   - Fill in the service account details
   - Click "Create and Continue"
   - Skip the optional steps and click "Done"

4. **Get Credentials:**
   - Click on your newly created service account
   - Go to the "Keys" tab
   - Click "Add Key" > "Create New Key"
   - Choose "JSON" format
   - Copy the `client_email` and `private_key` values to your `.env` file

5. **Share Your Spreadsheet:**
   - Share your Google Sheet with the service account email
   - The email is the `client_email` value from your credentials

#### Option B: API Key (Limited Functionality)

1. **Create API Key:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "API Key"
   - Copy the API key to your `.env` file

**Note:** API keys have limited functionality and may not work for all Google Sheets operations.

### 3. Configure Environment Variables

1. Copy the example environment file:
   ```bash
   cp env.example .env
   ```

2. Edit `.env` file with your credentials:

   **For Service Account (Recommended):**
   ```bash
   # Your Google Sheet ID
   SHEET_ID=your_sheet_id_here
   
   # Service account credentials
   GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
   GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----\n"
   ```

   **For API Key (Limited):**
   ```bash
   # Your Google Sheet ID
   SHEET_ID=your_sheet_id_here
   
   # API Key
   GOOGLE_API_KEY=your_api_key_here
   ```

### 4. Run the Scraper

```bash
node index.js
```

## Configuration Options

You can modify the configuration in `index.js`:

```javascript
const CONFIG = {
  url: "https://www.redfin.com/city/29671/MA/Barnstable/filter/min-price=500k,max-price=600k",
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  timeout: 20000,
  // Google Sheets configuration
  spreadsheetId: process.env.SHEET_ID || null,
  spreadsheetTitle: 'Redfin Property Listings',
  appendMode: true // Set to false to overwrite existing data
};
```

## How It Works

1. **Scraping:** The script scrapes Redfin with retry logic (up to 3 attempts)
2. **Data Processing:** Extracts property details (address, price, beds, baths, sq ft, status, link)
3. **Google Sheets Integration:**
   - If no `SPREADSHEET_ID` is provided, creates a new spreadsheet
   - If `appendMode` is true and spreadsheet has headers, appends new data
   - Otherwise, replaces all data in the spreadsheet
4. **Output:** Provides a direct link to the Google Sheet

## File Structure

```
scraper-plus-plus/
├── index.js              # Main scraper script
├── sheets.js             # Google Sheets integration
├── .env                  # Environment variables with your credentials
├── package.json          # Dependencies
└── README.md            # This file
```

## Troubleshooting

### Common Issues

1. **"No Google credentials found"**
   - Make sure you have either `GOOGLE_API_KEY` or both `GOOGLE_SERVICE_ACCOUNT_EMAIL` and `GOOGLE_PRIVATE_KEY` in your `.env` file
   - For service accounts, ensure the private key includes the full key with newlines

2. **"Authentication failed"**
   - Check that your credentials in `.env` are correct
   - Ensure the Google Sheets API is enabled in your Google Cloud project
   - For service accounts, make sure the private key is properly formatted

3. **"Permission denied"**
   - Share your Google Sheet with the service account email (if using service account)
   - The email is the `GOOGLE_SERVICE_ACCOUNT_EMAIL` value from your `.env` file

4. **"Navigation timeout"**
   - This is normal - the script has retry logic to handle this
   - If it persists, try increasing the timeout in the CONFIG object

### Getting Help

- Check the console output for detailed error messages
- Ensure all dependencies are installed: `npm install`
- Verify your Google Cloud project has the Sheets API enabled
- Make sure your service account has the necessary permissions

## Data Format

The spreadsheet will contain the following columns:
- Address
- Price
- Beds
- Baths
- Sq Ft
- Status
- Link
- Date Added

## License

ISC 