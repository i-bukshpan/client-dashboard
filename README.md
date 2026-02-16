# Client Management Dashboard

A comprehensive Client Management Dashboard for Financial Advisor Nehemia Druck, built with Next.js, Tailwind CSS, and Supabase.

## 📚 מדריכים (Hebrew Guides)

**מדריכים מקיפים בעברית למפתחים:**

- **[מדריך מקיף לניהול המערכת](מדריך_מקיף_לניהול_המערכת.md)** - מדריך מפורט להבנת המערכת ותפעולה (מומלץ להתחיל כאן!)
- **[מדריך מהיר](מדריך_מהיר.md)** - Quick Reference לעיון מהיר
- **[דוגמאות קוד מעשיות](דוגמאות_קוד_מעשיות.md)** - דוגמאות קוד מוכנות לשימוש מיידי

## Features

- **Main Dashboard**: View all clients with search functionality
- **Client Detail Pages**: Detailed views with Overview, Cash Flow, and Reports tabs
- **Real-time Data**: Integration with Google Sheets API (mock service included)
- **Hebrew RTL Support**: Full right-to-left layout with Hebrew fonts
- **Responsive Design**: Works on mobile and desktop
- **Data Visualization**: Charts using Recharts
- **PDF Reports**: Generate monthly reports

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS
- **Components**: Shadcn UI (Radix UI primitives)
- **Database/Auth**: Supabase
- **Charts**: Recharts
- **Icons**: Lucide React

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
Create a `.env.local` file:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Google Sheets Integration

The app includes a mock Google Sheets service. To integrate with the actual Google Sheets API:

1. Set up Google Cloud Project
2. Enable Google Sheets API
3. Create service account credentials
4. Replace the mock service in `lib/google-sheets.ts` with actual API calls

## Project Structure

```
client-dashboard/
├── app/
│   ├── clients/
│   │   └── [id]/
│   │       └── page.tsx      # Client detail page
│   ├── layout.tsx             # Root layout with sidebar
│   ├── page.tsx               # Main dashboard
│   └── globals.css            # Global styles with RTL support
├── components/
│   ├── ui/                    # Shadcn UI components
│   ├── sidebar.tsx            # Navigation sidebar
│   ├── client-card.tsx        # Client card component
│   ├── add-client-dialog.tsx  # Add client modal
│   ├── date-range-picker.tsx  # Date filter component
│   ├── overview-tab.tsx       # Overview tab content
│   ├── cash-flow-tab.tsx      # Cash flow table
│   ├── reports-tab.tsx        # Reports tab
│   └── edit-sheet-dialog.tsx  # Edit sheet ID modal
└── lib/
    ├── supabase.ts            # Supabase client
    ├── google-sheets.ts       # Google Sheets API service
    └── utils.ts               # Utility functions
```

## Color Scheme

- **Navy Blue**: #1e293b (Primary)
- **Grey**: #64748b (Secondary)
- **Emerald Green**: #10b981 (Positive indicators)

## Hebrew Fonts

The app uses Google Fonts:
- Assistant (Primary)
- Heebo (Fallback)

Both fonts support Hebrew characters and RTL layout.

