// NOTE: When running in GitHub Actions, ensure all required secrets are set and do not contain extra whitespace.
require("dotenv").config();
const puppeteer = require("puppeteer");
const GoogleSheetsManager = require("./sheets");

// Get city from command line argument
const redfinUrl = process.argv[2];
const sheetUrl = process.argv[3];

if (!redfinUrl || !sheetUrl) {
  console.error("Usage: node index.js <Redfin search URL> <Google Sheet URL>");
  process.exit(1);
}

// Configuration
const CONFIG = {
  url: redfinUrl,
  userAgent:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  timeout: 20000, // 20 seconds
  spreadsheetTitle: "Redfin Property Listings",
  spreadsheetId: getSheetIdFromUrl(sheetUrl),
  appendMode: true,
  waitUntil: "domcontentloaded",
};

// CSS selectors for data extraction
const SELECTORS = {
  homeCards: ".bp-Homecard, .bp-InteractiveHomecard",
  price: ".bp-Homecard__Price--value",
  address: ".bp-Homecard__Address",
  beds: ".bp-Homecard__Stats--beds",
  baths: ".bp-Homecard__Stats--baths",
  sqft: ".bp-Homecard__Stats--sqft",
  status: ".bp-Homecard__Sash",
};

function getSheetIdFromUrl(sheetUrl) {
  const match = sheetUrl.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

async function scrapeRedfinWithRetry(maxRetries = 3) {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const listings = await scrapeRedfin();
      return listings;
    } catch (error) {
      console.error(`Attempt ${attempt} failed:`, error); // Log full error
      lastError = error;
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  }
  throw new Error(`Failed after ${maxRetries} attempts: ${lastError}`);
}

async function scrapeRedfin() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  try {
    console.log("Loading Redfin page...");

    await page.setUserAgent(CONFIG.userAgent);
    await page.goto(CONFIG.url, {
      waitUntil: CONFIG.waitUntil,
      timeout: CONFIG.timeout,
    });

    // Log page content if needed (for debugging bot detection)
    const pageContent = await page.content();
    if (/captcha|unusual traffic|verify you are human/i.test(pageContent)) {
      console.error(
        "Possible bot detection or captcha encountered on Redfin page."
      );
      console.error("Page content snippet:", pageContent.slice(0, 500));
    }

    console.log("Page loaded successfully");
    console.log("Scrolling to load all listings...");

    await autoScroll(page);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const listings = await extractListings(page);
    return listings;
  } catch (error) {
    console.error("Error during scraping:", error); // Log full error
    try {
      const failedContent = await page.content();
      console.error(
        "Failed page content snippet:",
        failedContent.slice(0, 500)
      );
    } catch (e) {
      console.error("Could not retrieve failed page content:", e);
    }
    throw error;
  } finally {
    await browser.close();
  }
}

// Helper function to scroll the page
async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 100;
      const timer = setInterval(() => {
        const scrollHeight = document.documentElement.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  });
}

async function extractListings(page) {
  return await page.evaluate((selectors) => {
    const getText = (element, selector) => {
      const el = element.querySelector(selector);
      return el ? el.textContent.trim() : null;
    };
    // Helper to normalize numbers from text
    const normalizeNumber = (str) => {
      if (!str) return null;
      // Remove commas, non-numeric except dot
      const num = str.replace(/[^\d.]/g, "");
      return num ? parseFloat(num) : null;
    };
    const extractPropertyData = (card) => {
      const price = getText(card, selectors.price) || "—";
      const address = getText(card, selectors.address) || "—";
      const bedsRaw = getText(card, selectors.beds);
      const bathsRaw = getText(card, selectors.baths);
      const sqftRaw = getText(card, selectors.sqft);
      let status = getText(card, selectors.status);
      if (status === "ABOUT THIS HOME") {
        status = null;
      }
      const link = card.href || card.querySelector("a")?.href || null;
      // Extract Redfin property ID from URL
      let listingId = null;
      if (link) {
        const match = link.match(/\/home\/(\d+)/);
        if (match) {
          listingId = match[1];
        }
      }
      const beds = bedsRaw ? normalizeNumber(bedsRaw) : "—";
      let baths = "—";
      if (bathsRaw) {
        const parsedBaths = normalizeNumber(bathsRaw);
        if (typeof parsedBaths === "number" && !isNaN(parsedBaths)) {
          baths = parsedBaths;
        }
      }
      const sqft = sqftRaw ? normalizeNumber(sqftRaw) : "—";
      // Parse price as number (remove $ and commas)
      const priceNum =
        price && price !== "—" ? parseInt(price.replace(/[^\d]/g, "")) : null;
      // Split status into listingStatus and openHouseInfo
      let listingStatus = "—";
      let openHouseInfo = null;
      let isOpenHouse = false;
      if (status) {
        if (/OPEN/i.test(status)) {
          openHouseInfo = status;
          isOpenHouse = true;
        } else if (
          /COMING SOON|NEW|ACTIVE|PENDING|CONTINGENT|SOLD|VIDEO TOUR|3D WALKTHROUGH|NEW CONSTRUCTION/i.test(
            status
          )
        ) {
          listingStatus = status;
        } else {
          // If status doesn't match known types, default to listingStatus
          listingStatus = status;
        }
      }
      // Calculate price per sqft
      let pricePerSqft = "—";
      if (priceNum && sqft && sqft !== "—") {
        pricePerSqft = Math.round(priceNum / sqft);
      }
      // Extract first image URL
      let imageUrl = null;
      const img = card.querySelector("img");
      if (img && img.src) {
        imageUrl = img.src;
      }
      // Extract neighborhood (only use Redfin tag, do not parse from address)
      let neighborhood = "—";
      const hoodEl = card.querySelector(
        ".neighborhood, .bp-Homecard__Neighborhood"
      );
      if (hoodEl) {
        neighborhood = hoodEl.textContent.trim();
      }
      // Extract days on market (look for text like 'X days on market')
      let daysOnMarket = "—";
      const domText = card.textContent;
      const domMatch = domText.match(/(\d+) days? on market/i);
      if (domMatch) {
        daysOnMarket = parseInt(domMatch[1]);
      }
      // Extract zip code from address (last 5 digits)
      let zipCode = "—";
      if (address && typeof address === "string") {
        const zipMatch = address.match(/(\d{5})(?:[-\s]|$)/);
        if (zipMatch) {
          zipCode = zipMatch[1];
        }
      }
      return {
        listingId,
        price,
        address,
        zipCode,
        beds,
        baths,
        sqft,
        pricePerSqft,
        listingStatus,
        openHouseInfo,
        isOpenHouse,
        neighborhood,
        daysOnMarket,
        imageUrl,
        link,
      };
    };
    const cards = document.querySelectorAll(selectors.homeCards);
    // Deduplicate by listingId
    const seen = new Set();
    return Array.from(cards)
      .map((card) => extractPropertyData(card))
      .filter(
        (listing) =>
          listing.address &&
          listing.listingId &&
          !seen.has(listing.listingId) &&
          seen.add(listing.listingId)
      );
  }, SELECTORS);
}

// Send data to Google Sheets
async function sendToGoogleSheets(listings) {
  try {
    const sheetsManager = new GoogleSheetsManager();
    await sheetsManager.authenticate();

    let spreadsheetId = CONFIG.spreadsheetId;
    let spreadsheetUrl;

    // Create new spreadsheet if none specified
    if (!spreadsheetId) {
      spreadsheetId = await sheetsManager.createSpreadsheet(
        CONFIG.spreadsheetTitle
      );
      console.log(`Created new spreadsheet with ID: ${spreadsheetId}`);
    }

    // Check if spreadsheet has proper structure
    const hasStructure = await sheetsManager.checkSpreadsheetStructure(
      spreadsheetId
    );

    if (CONFIG.appendMode && hasStructure) {
      // Append to existing spreadsheet
      const appendResult = await sheetsManager.appendToSpreadsheet(
        spreadsheetId,
        listings
      );
      if (
        appendResult &&
        appendResult !==
          `https://docs.google.com/spreadsheets/d/${spreadsheetId}`
      ) {
        console.log("Listings appended to existing spreadsheet successfully");
      }
      spreadsheetUrl = appendResult;
    } else {
      // Update/replace data in spreadsheet
      spreadsheetUrl = await sheetsManager.updateSpreadsheet(
        spreadsheetId,
        listings
      );
      console.log("Listings sent to spreadsheet successfully");
    }

    console.log(`Spreadsheet URL: ${spreadsheetUrl}`);
    return spreadsheetUrl;
  } catch (error) {
    console.error("Error sending data to Google Sheets:", error.message);
    throw error;
  }
}

// Run the scraper
async function main() {
  try {
    const listings = await scrapeRedfinWithRetry();
    if (listings.length === 0) {
      console.log("No listings found - this might indicate an issue");
    } else {
      await sendToGoogleSheets(listings);
    }
  } catch (error) {
    console.error("Scraping failed completely:", error);
    process.exit(1);
  }
}

main();
