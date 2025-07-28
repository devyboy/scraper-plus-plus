const { google } = require('googleapis');

// Column index constants for readability
const COL_ADDRESS = 0;
const COL_LISTING_ID = 1;
const COL_ZIP = 2;
const COL_PRICE = 3;
const COL_BEDS = 4;
const COL_BATHS = 5;
const COL_SQFT = 6;
const COL_PRICE_PER_SQFT = 7;
const COL_LISTING_STATUS = 8;
const COL_IS_OPEN_HOUSE = 9;
const COL_OPEN_HOUSE_INFO = 10;
const COL_LINK = 11;
const COL_DATE_ADDED = 12;

class GoogleSheetsManager {
  constructor() {
    this.auth = null;
    this.sheets = null;
  }

  // Initialize authentication
  async authenticate() {
    try {
      const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
      const privateKey = process.env.GOOGLE_PRIVATE_KEY;
      
      if (serviceAccountEmail && privateKey) {
        // Use service account credentials from environment variables
        this.auth = new google.auth.GoogleAuth({
          credentials: {
            client_email: serviceAccountEmail,
            private_key: privateKey.replace(/\\n/g, '\n'), // Handle escaped newlines
          },
          scopes: [
            'https://www.googleapis.com/auth/spreadsheets'
          ]
        });
      } 
      else {
        throw new Error('No Google credentials found. Please set GOOGLE_API_KEY or GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY in your .env file');
      }

      this.sheets = google.sheets({ version: 'v4', auth: this.auth });
    } catch (error) {
      console.error('Authentication failed:', error.message);
      throw error;
    }
  }

  // Create a new spreadsheet
  async createSpreadsheet(title) {
    try {
      const resource = {
        properties: {
          title: title
        }
      };

      const response = await this.sheets.spreadsheets.create({
        resource,
        fields: 'spreadsheetId'
      });

      const spreadsheetId = response.data.spreadsheetId;
      return spreadsheetId;
    } catch (error) {
      console.error('Error creating spreadsheet:', error.message);
      throw error;
    }
  }

  // Helper: Convert a listing object to a row array
  listingToRow(listing) {
    return [
      listing.address || '',
      listing.listingId || '',
      listing.zipCode || '',
      listing.price || '',
      listing.beds || '',
      listing.baths || '',
      listing.sqft || '',
      listing.pricePerSqft || '',
      listing.listingStatus || '',
      listing.isOpenHouse ? 'Yes' : 'No',
      listing.openHouseInfo || '',
      listing.link || '',
      new Date().toISOString().split('T')[0]
    ];
  }

  // Helper: Build formatting requests for a given number of rows
  buildFormattingRequests(rowCount, headersLength) {
    return [
      {
        repeatCell: {
          range: {
            sheetId: 0,
            startRowIndex: 0,
            endRowIndex: 1,
            startColumnIndex: 0,
            endColumnIndex: headersLength
          },
          cell: {
            userEnteredFormat: {
              textFormat: { foregroundColor: { red: 0.2, green: 0.2, blue: 0.2 }, bold: true },
              horizontalAlignment: 'CENTER',
              verticalAlignment: 'MIDDLE'
            }
          },
          fields: 'userEnteredFormat(textFormat,horizontalAlignment,verticalAlignment)'
        }
      },
      {
        updateBorders: {
          range: {
            sheetId: 0,
            startRowIndex: 0,
            endRowIndex: rowCount,
            startColumnIndex: 0,
            endColumnIndex: headersLength
          },
          top: { style: 'SOLID', width: 1 },
          bottom: { style: 'SOLID', width: 1 },
          left: { style: 'SOLID', width: 1 },
          right: { style: 'SOLID', width: 1 },
          innerHorizontal: { style: 'SOLID', width: 1 },
          innerVertical: { style: 'SOLID', width: 1 }
        }
      },
      {
        updateSheetProperties: {
          properties: {
            sheetId: 0,
            gridProperties: { frozenRowCount: 1, frozenColumnCount: 1 }
          },
          fields: 'gridProperties.frozenRowCount,gridProperties.frozenColumnCount'
        }
      },
      {
        setBasicFilter: {
          filter: {
            range: {
              sheetId: 0,
              startRowIndex: 0,
              endRowIndex: rowCount,
              startColumnIndex: 0,
              endColumnIndex: headersLength
            }
          }
        }
      },
      // Price as currency
      {
        repeatCell: {
          range: {
            sheetId: 0,
            startRowIndex: 1,
            endRowIndex: rowCount,
            startColumnIndex: COL_PRICE,
            endColumnIndex: COL_PRICE + 1
          },
          cell: {
            userEnteredFormat: {
              numberFormat: { type: 'CURRENCY', pattern: '"$"#,##0' }
            }
          },
          fields: 'userEnteredFormat.numberFormat'
        }
      },
      // Price per Sq Ft as currency
      {
        repeatCell: {
          range: {
            sheetId: 0,
            startRowIndex: 1,
            endRowIndex: rowCount,
            startColumnIndex: COL_PRICE_PER_SQFT,
            endColumnIndex: COL_PRICE_PER_SQFT + 1
          },
          cell: {
            userEnteredFormat: {
              numberFormat: { type: 'CURRENCY', pattern: '"$"#,##0' }
            }
          },
          fields: 'userEnteredFormat.numberFormat'
        }
      },
      // Sq Ft as plain number
      {
        repeatCell: {
          range: {
            sheetId: 0,
            startRowIndex: 1,
            endRowIndex: rowCount,
            startColumnIndex: COL_SQFT,
            endColumnIndex: COL_SQFT + 1
          },
          cell: {
            userEnteredFormat: {
              numberFormat: { type: 'NUMBER', pattern: '#,##0' }
            }
          },
          fields: 'userEnteredFormat.numberFormat'
        }
      },
      // Date Added as date
      {
        repeatCell: {
          range: {
            sheetId: 0,
            startRowIndex: 1,
            endRowIndex: rowCount,
            startColumnIndex: COL_DATE_ADDED,
            endColumnIndex: COL_DATE_ADDED + 1
          },
          cell: {
            userEnteredFormat: {
              numberFormat: { type: 'DATE', pattern: 'yyyy-mm-dd' }
            }
          },
          fields: 'userEnteredFormat.numberFormat'
        }
      }
    ];
  }

  async updateSpreadsheet(spreadsheetId, data, sheetName = 'Sheet1') {
    try {
      const headers = [
        "Address",
        "Listing ID",
        "Zip Code",
        "Price",
        "Beds",
        "Baths",
        "Sq Ft",
        "Price per Sq Ft",
        "Listing Status",
        "Is Open House?",
        "Open House Info",
        "Link",
        "Date Added",
      ];

      // Deduplicate data by listing ID
      const uniqueListings = new Map();
      data.forEach((listing) => {
        if (listing.listingId && !uniqueListings.has(listing.listingId)) {
          uniqueListings.set(listing.listingId, listing);
        }
      });

      const deduplicatedData = Array.from(uniqueListings.values());
      const rows = deduplicatedData.map((listing) =>
        this.listingToRow(listing)
      );
      const allData = [headers, ...rows];

      await this.sheets.spreadsheets.values.clear({
        spreadsheetId,
        range: sheetName,
      });
      await this.sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A1`,
        valueInputOption: "RAW",
        resource: { values: allData },
      });
      const requests = this.buildFormattingRequests(
        rows.length + 1,
        headers.length
      );
      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        resource: { requests },
      });
      return `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
    } catch (error) {
      console.error('Error updating spreadsheet:', error.message);
      throw error;
    }
  }

  // Auto-resize columns for better readability
  async autoResizeColumns(spreadsheetId, sheetName, columnCount) {
    try {
      const requests = [];
      
      for (let i = 0; i < columnCount; i++) {
        requests.push({
          autoResizeDimensions: {
            dimensions: {
              sheetId: 0, // Assuming first sheet
              dimension: 'COLUMNS',
              startIndex: i,
              endIndex: i + 1
            }
          }
        });
      }

      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        resource: {
          requests
        }
      });
    } catch (error) {
      console.warn('Could not auto-resize columns:', error.message);
    }
  }

  // Helper to get all existing listing IDs from the sheet
  async getExistingListingIds(spreadsheetId, sheetName = 'Sheet1') {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!B2:B`, // Listing ID column, skip header
      });
      const values = response.data.values || [];
      // Flatten and filter out empty values
      return new Set(values.map(row => row[0]).filter(Boolean));
    } catch (error) {
      console.error('Error fetching existing listing IDs:', error.message);
      return new Set();
    }
  }

  async appendToSpreadsheet(spreadsheetId, data, sheetName = 'Sheet1') {
    try {
      const headers = ['Address', 'Listing ID', 'Zip Code', 'Price', 'Beds', 'Baths', 'Sq Ft', 'Price per Sq Ft', 'Listing Status', 'Is Open House?', 'Open House Info', 'Link', 'Date Added'];
      const response = await this.sheets.spreadsheets.values.get({ spreadsheetId, range: `${sheetName}!A:H` });
      const currentRows = response.data.values ? response.data.values.length : 1;
      const existingIds = await this.getExistingListingIds(spreadsheetId, sheetName);
      const newData = data.filter(listing => listing.listingId && !existingIds.has(listing.listingId));
      if (newData.length === 0) {
        console.log("   No new listings to append.");
        return {
          spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
          newCount: 0,
        };
      }
      const rows = newData.map(listing => this.listingToRow(listing));
      await this.sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${sheetName}!A:H`,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        resource: { values: rows }
      });
      const requests = this.buildFormattingRequests(currentRows + rows.length, headers.length);
      await this.sheets.spreadsheets.batchUpdate({ spreadsheetId, resource: { requests } });
      console.log(`   Added ${newData.length} new listings to spreadsheet`);
      return {
        spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
        newCount: newData.length,
      };
    } catch (error) {
      console.error('Error appending to spreadsheet:', error.message);
      throw error;
    }
  }

  // Check if spreadsheet exists and has headers
  async checkSpreadsheetStructure(spreadsheetId, sheetName = 'Sheet1') {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!A1:M1`
      });

      const values = response.data.values;
      if (!values || values.length === 0) {
        return false; // No data, needs headers
      }

      const headers = values[0];
      const expectedHeaders = ['Address', 'Listing ID', 'Price', 'Beds', 'Baths', 'Sq Ft', 'Price per Sq Ft', 'Listing Status', 'Is Open House?', 'Open House Info', 'Image URL', 'Link', 'Date Added'];
      
      return headers.length >= expectedHeaders.length;
    } catch (error) {
      console.error('Error checking spreadsheet structure:', error.message);
      return false;
    }
  }
}

module.exports = GoogleSheetsManager; 