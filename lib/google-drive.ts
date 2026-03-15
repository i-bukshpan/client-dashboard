import { google } from 'googleapis'

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
)

// For now, we might need a way to store/retrieve the refresh token
// This is a placeholder for the integration logic
export async function getDriveService(refreshToken: string) {
  oauth2Client.setCredentials({ refresh_token: refreshToken })
  return google.drive({ version: 'v3', auth: oauth2Client })
}

export async function listFiles(folderId: string, refreshToken: string) {
  try {
    const drive = await getDriveService(refreshToken)
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'files(id, name, mimeType, webViewLink)',
    })
    return response.data.files || []
  } catch (error) {
    console.error('Error listing drive files:', error)
    return []
  }
}
