To get the channel from a video ID using the YouTube Data API, you must perform a two-step process: first, retrieve the video details to get the channelId, and second, use the channelId to fetch the channel's information. 
Stack Overflow
Stack Overflow
Prerequisites
A Google Account.
A project in the Google Cloud Console with the YouTube Data API v3 enabled.
An API key obtained from the console. 
Step 1: Get the Channel ID from the Video ID
Use the videos.list endpoint, specifying part=snippet and the id of the video. The snippet part of the response contains the channelId. 
API Request URL:
GET https://www.googleapis.com{VIDEO_ID}&key={YOUR_API_KEY}
Replace {VIDEO_ID} with the ID of the YouTube video.
Replace {YOUR_API_KEY} with your actual API key. 
Example Response Snippet (contains the channelId):
json
{
  "items": [
    {
      "snippet": {
        "publishedAt": "...",
        "channelId": "UC1yBKRuGpC1tSM73A0ZjYjQ", 
        "title": "...",
        "description": "...",
        // ... more properties
      }
    }
  ]
}
Step 2: Get the Channel Details from the Channel ID
Once you have the channelId, use the channels.list endpoint to retrieve details about the channel, such as its title, description, and statistics. 
API Request URL:
GET https://www.googleapis.com{CHANNEL_ID}&key={YOUR_API_KEY}
Replace {CHANNEL_ID} with the channelId obtained in Step 1.
Replace {YOUR_API_KEY} with your actual API key.
You can request different part values (e.g., snippet, statistics, contentDetails) to get specific information. 
Example Response Snippet (contains the channel title):
json
{
  "items": [
    {
      "snippet": {
        "title": "The Young Turks",
        "description": "...",
        // ... more properties
      },
      "statistics": {
        // ... statistics like view count
      }
    }
  ]
}
For more details on the available parameters and responses, refer to the official documentation for the Channels: list and Videos: list methods. 