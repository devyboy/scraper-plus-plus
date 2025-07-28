const { runScraper } = require("./lib/scraper");
const { supabase } = require("./lib/supabase");
const EmailService = require("./lib/email");

(async () => {
  console.log("🔍 Starting job processor...");

  // Get all active jobs
  const { data: jobs, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("active", true);

  if (error) {
    console.error("❌ Failed to fetch jobs from database:", error.message);
    process.exit(1);
  }

  if (jobs.length === 0) {
    console.log("ℹ️  No active jobs found in database");
    return;
  }

  console.log(`Found ${jobs.length} active job(s) to process`);

  // Check if any jobs have user emails before initializing email service
  const jobsWithEmails = jobs.filter((job) => job.user_email);
  let emailService = null;
  
  if (jobsWithEmails.length > 0) {
    console.log(
      `📧 ${jobsWithEmails.length} job(s) have email notifications enabled`
    );
    emailService = new EmailService();
  } else {
    console.log("ℹ️  No jobs have email notifications enabled");
  }

  for (const job of jobs) {
    const { id, redfin_url, sheet_url, user_email } = job;
    const startTime = new Date(); // Capture start time

    console.log(`\n🚀 Processing job ${id.substring(0, 8)}...`);
    console.log(`Redfin: ${redfin_url}`);
    console.log(`Sheet: ${sheet_url}`);
    if (user_email) {
      console.log(`User: ${user_email}`);
    }

    try {
      // Update job status to running
      await supabase
        .from("jobs")
        .update({ job_status: "running" })
        .eq("id", id);

      // Run the scraper
      const result = await runScraper(redfin_url, sheet_url);

      if (result.success) {
        const timeNow = new Date();

        // Next run is 30 minutes after the start time
        const nextRunTime = new Date(startTime.getTime() + 1000 * 60 * 30);

        // Update job status to success
        await supabase
          .from("jobs")
          .update({
            job_status: "success",
            last_run: timeNow.toISOString(),
            next_run: nextRunTime.toISOString(),
          })
          .eq("id", id);

        console.log(`✅ Job ${id.substring(0, 8)} completed successfully`);
        console.log(`Found ${result.count} listings`);
        console.log(`Started at: ${startTime.toLocaleTimeString()}`);
        console.log(`Next run: ${nextRunTime.toLocaleTimeString()}`);

        // Send email notification if new listings were found and user has email
        if (result.count > 0 && user_email && emailService) {
          try {
            await emailService.sendNewListingsNotification(
              user_email,
              { redfin_url, sheet_url },
              result.count,
              result.spreadsheetUrl
            );
          } catch (emailError) {
            console.error(
              `⚠️  Failed to send email notification: ${emailError.message}`
            );
          }
        } else if (result.count === 0 && user_email) {
          console.log(`ℹ️  No new listings found, skipping email notification`);
        } else if (!user_email) {
          console.log(`ℹ️  No user email found, skipping email notification`);
        }
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      // Update job status to failed
      await supabase.from("jobs").update({ job_status: "failed" }).eq("id", id);
      console.error(`❌ Job ${id.substring(0, 8)} failed: ${error.message}`);

      // Send error notification if user has email
      if (user_email && emailService) {
        try {
          await emailService.sendErrorNotification(
            user_email,
            { redfin_url, sheet_url },
            error.message
          );
        } catch (emailError) {
          console.error(
            `⚠️  Failed to send error notification: ${emailError.message}`
          );
        }
      }
    }

    console.log(""); // Empty line between jobs
  }

  console.log("\n🏁 Job processor completed");
})();
