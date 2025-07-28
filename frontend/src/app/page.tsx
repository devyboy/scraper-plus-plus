"use client"

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function Home() {
  const [redfinUrl, setRedfinUrl] = useState("");
  const [sheetUrl, setSheetUrl] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const anonymousSignIn = async () => {
      const { data: userData } = await supabase.auth.getUser();
      
      if (!userData.user) {
        await supabase.auth.signInAnonymously();
      }
    }

    anonymousSignIn();
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const { data: userData } = await supabase.auth.getUser();

    const insertData = {
      redfin_url: redfinUrl,
      sheet_url: sheetUrl,
      user_id: userData.user?.id,
      user_email: userEmail, // Store email with the job
    }

    const { error } = await supabase.from("jobs").insert([insertData]);
    
    if (!error) {
      setSubmitted(true);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center">
      {!submitted ? (
        <form className="flex flex-col gap-4 w-full max-w-md" onSubmit={handleSubmit}>
          <input
            type="url"
            placeholder="Enter Redfin search URL"
            className="border p-2 rounded"
            value={redfinUrl}
            onChange={(e) => setRedfinUrl(e.target.value)}
            required
          />
          <input
            type="url"
            placeholder="Enter Google Sheet URL"
            className="border p-2 rounded"
            value={sheetUrl}
            onChange={(e) => setSheetUrl(e.target.value)}
            required
          />
          <input
            type="email"
            placeholder="Enter your email for notifications (optional)"
            className="border p-2 rounded"
            value={userEmail}
            onChange={(e) => setUserEmail(e.target.value)}
          />
          <button type="submit" className="bg-blue-500 text-white p-2 rounded">
            Start Tracker
          </button>
        </form>
      ) : (
        <div className="text-center">
          <p className="text-green-600 mb-2">✅ Tracker started! Check your sheet for updates.</p>
          {userEmail && (
            <p className="text-blue-600 text-sm">
              📧 You'll receive email notifications when new listings are found.
            </p>
          )}
        </div>
      )}
    </main>
  );
}