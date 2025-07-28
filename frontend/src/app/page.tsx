"use client"
import { useAuth } from "../../lib/auth-context";
import { useState, useEffect } from 'react'
import { supabase } from "../../lib/supabase"

interface Job {
  id: string
  redfin_url: string
  sheet_url: string
  active: boolean
  created_at: string
  last_run: string | null
  next_run: string | null
}

// Helper function to format dates as 24-hour time
const formatTime = (dateString: string | null): string => {
  if (!dateString) return 'Never'
  
  const date = new Date(dateString)
  return date.toLocaleTimeString('en-US', { 
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
}

// Helper function to format future dates as 24-hour time
const formatFutureTime = (dateString: string | null): string => {
  if (!dateString) return 'Not scheduled'
  
  const date = new Date(dateString)
  return date.toLocaleTimeString('en-US', { 
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
}

export default function Home() {
  const { user, loading, signOut } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([])
  const [loadingJobs, setLoadingJobs] = useState(true)
  const [redfinUrl, setRedfinUrl] = useState("")
  const [sheetUrl, setSheetUrl] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [copied, setCopied] = useState(false)
  const [sharedChecked, setSharedChecked] = useState(false)
  const [sneedChecked, setSneedChecked] = useState(false)

  useEffect(() => {
    if (user) {
      fetchJobs()
    }
  }, [user])

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText('sheets-api@real-estate-tracker-466519.iam.gserviceaccount.com');
      setCopied(true);
      setTimeout(() => setCopied(false), 5000); // Hide after 2 seconds
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };

  const fetchJobs = async () => {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching jobs:', error)
      } else {
        setJobs(data || [])
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoadingJobs(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitted(true)

    try {
      const { data, error } = await supabase.from("jobs").insert([
        {
          redfin_url: redfinUrl,
          sheet_url: sheetUrl,
          user_id: user?.id,
          user_email: user?.email,
          active: true,
        },
      ])

      if (error) {
        console.error("Error inserting job:", error)
        alert("Error creating job. Please try again.")
      } else {
        console.log("Job created successfully:", data)
        setRedfinUrl("")
        setSheetUrl("")
        setSharedChecked(false)
        setSneedChecked(false)
        alert("Job created successfully! The scraper will start monitoring this listing.")
        // Refresh the jobs list
        fetchJobs()
      }
    } catch (error) {
      console.error("Error:", error)
      alert("Error creating job. Please try again.")
    }

    setSubmitted(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  // Show landing page for unauthenticated users
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Redfin Property Tracker
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              Track Redfin property listings with automated scraping
            </p>
          </div>
          <div className="space-y-4">
            <a
              href="/auth/signin"
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Sign in
            </a>
            <a
              href="/auth/signup"
              className="group relative w-full flex justify-center py-2 px-4 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Create account
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Show jobs interface for authenticated users
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Redfin Property Tracker</h1>
            <p className="text-gray-700">Welcome, {user.email}</p>
          </div>
          <button
            onClick={signOut}
            className="text-sm text-gray-600 hover:text-gray-900 font-medium"
          >
            Sign out
          </button>
        </div>

        {/* Create New Job Form */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Create New Tracking Job</h2>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4 p-6 mb-8">
            <div>
              <label htmlFor="redfinUrl" className="block text-sm font-medium text-gray-900">
                Redfin URL
              </label>
              <input
                type="url"
                id="redfinUrl"
                required
                placeholder="https://www.redfin.com/city/29470/IL/Chicago"
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 placeholder-gray-500"
                value={redfinUrl}
                onChange={(e) => setRedfinUrl(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="sheetUrl" className="block text-sm font-medium text-gray-900">
                Google Sheet URL
              </label>
              <input
                type="url"
                id="sheetUrl"
                required
                placeholder="https://docs.google.com/spreadsheets/d/..."
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 placeholder-gray-500"
                value={sheetUrl}
                onChange={(e) => setSheetUrl(e.target.value)}
              />
            </div>

            <div>
              <div className="flex items-start">
                <div className="flex items-center h-5">
                  <input
                    id="shared"
                    name="shared"
                    type="checkbox"
                    required
                    className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded"
                    checked={sharedChecked}
                    onChange={(e) => setSharedChecked(e.target.checked)}
                  />
                </div>
                <div className="ml-3 text-sm">
                  <label htmlFor="shared" className="font-medium text-gray-900">
                    I have shared my Google Sheet with{" "}
                    <button
                      type="button"
                      onClick={copyToClipboard}
                      className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                    >
                      sheets-api@real-estate-tracker-466519.iam.gserviceaccount.com
                      <svg className="ml-1 h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                    {copied && (
                      <span className="ml-2 text-green-600 text-xs">Copied!</span>
                    )}
                  </label>
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-start">
                <div className="flex items-center h-5">
                  <input
                    id="editor"
                    name="editor"
                    type="checkbox"
                    required
                    className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded"
                    checked={sneedChecked}
                    onChange={(e) => setSneedChecked(e.target.checked)}
                  />
                </div>
                <div className="ml-3 text-sm">
                  <label htmlFor="editor" className="font-medium text-gray-900">
                    I have given the <strong>Editor</strong> role to the above account.
                  </label>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitted}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitted ? "Creating..." : "Create Tracking Job"}
            </button>
          </form>

          {submitted && (
            <div className="mt-4 text-sm text-gray-700">
              Creating your tracking job...
            </div>
          )}
        </div>

        {/* Jobs List */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Your Tracking Jobs</h3>
          </div>
          
          {loadingJobs ? (
            <div className="text-center py-8">
              <div className="text-xl text-gray-900">Loading your jobs...</div>
            </div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-xl text-gray-700 mb-4">No tracking jobs found</div>
              <p className="text-sm text-gray-600">Create your first tracking job above</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Redfin URL
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Sheet URL
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Last Run
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Next Run
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {jobs.map((job) => (
                    <tr key={job.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          job.active ? 'bg-green-100 text-green-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {job.active ? 'Active' : 'Stopped'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <a
                          href={job.redfin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-700 hover:text-indigo-900 truncate block max-w-xs font-medium"
                        >
                          {job.redfin_url}
                        </a>
                      </td>
                      <td className="px-6 py-4">
                        <a
                          href={job.sheet_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-700 hover:text-indigo-900 truncate block max-w-xs font-medium"
                        >
                          View Sheet
                        </a>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {formatTime(job.last_run)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {formatFutureTime(job.next_run)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}