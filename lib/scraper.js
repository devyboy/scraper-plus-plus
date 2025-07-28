// NOTE: When running in GitHub Actions, ensure all required secrets are set and do not contain extra whitespace.
require("dotenv").config();

const puppeteer = require("puppeteer");
const GoogleSheetsManager = require("./sheets");

// Configuration
const CONFIG = {
  userAgent:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  timeout: 20000, // 20 seconds
  spreadsheetTitle: "Redfin Property Listings",
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

async function scrapeRedfinWithRetry(redfinUrl, maxRetries = 3) {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const listings = await scrapeRedfin(redfinUrl);
      return listings;
    } catch (error) {
      if (attempt < maxRetries) {
        console.log(
          `⚠️  Attempt ${attempt} failed, retrying in 5s... (${error.message})`
        );
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
      lastError = error;
    }
  }
  throw new Error(
    `Scraping failed after ${maxRetries} attempts: ${lastError.message}`
  );
}

async function scrapeRedfin(redfinUrl) {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  try {
    console.log("\tLoading Redfin page...");

    await page.setUserAgent(CONFIG.userAgent);
    await page.goto(redfinUrl, {
      waitUntil: CONFIG.waitUntil,
      timeout: CONFIG.timeout,
    });

    // Check for bot detection
    const pageContent = await page.content();
    if (/captcha|unusual traffic|verify you are human/i.test(pageContent)) {
      console.error("  ⚠️  Possible bot detection detected on page");
    }

    console.log("\tPage loaded successfully");
    console.log("\tScrolling to load all listings...");

    await autoScroll(page);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const listings = await extractListings(page);
    return listings;
  } catch (error) {
    console.error(`\t❌ Scraping error: ${error.message}`);
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
async function sendToGoogleSheets(listings, sheetUrl) {
  try {
    const sheetsManager = new GoogleSheetsManager();
    await sheetsManager.authenticate();

    let spreadsheetId = getSheetIdFromUrl(sheetUrl);
    let spreadsheetUrl;

    // Create new spreadsheet if none specified
    if (!spreadsheetId) {
      spreadsheetId = await sheetsManager.createSpreadsheet(
        CONFIG.spreadsheetTitle
      );
      console.log(`\tCreated new spreadsheet: ${spreadsheetId}`);
    }

    // Always append - the method handles new spreadsheets and deduplication
    const appendResult = await sheetsManager.appendToSpreadsheet(
      spreadsheetId,
      listings
    );

    if (
      appendResult &&
      appendResult !== `https://docs.google.com/spreadsheets/d/${spreadsheetId}`
    ) {
      console.log("\tAppended to existing spreadsheet");
    }

    return {
      spreadsheetUrl: appendResult,
      newCount: appendResult.newCount || 0,
    };
  } catch (error) {
    console.error(`\t❌ Google Sheets error: ${error.message}`);
    throw error;
  }
}

// Main scraper function
async function runScraper(redfinUrl, sheetUrl) {
  try {
    const listings = await scrapeRedfinWithRetry(redfinUrl);

    if (listings.length === 0) {
      return {
        success: false,
        message: "No listings found on page",
        listings: [],
      };
    }

    console.log(
      `\tFound ${listings.length} listings, checking for duplicates...`
    );
    const result = await sendToGoogleSheets(listings, sheetUrl);

    return {
      success: true,
      message: "Scraping completed successfully",
      listings: listings,
      spreadsheetUrl: result.spreadsheetUrl,
      count: result.newCount || 0,
    };
  } catch (error) {
    return {
      success: false,
      message: `Scraping failed: ${error.message}`,
      error: error,
    };
  }
}

module.exports = { runScraper };
