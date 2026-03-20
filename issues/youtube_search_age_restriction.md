Yes, the YouTube Data API v3 provides built-in methods for both checking the age-restriction status of a specific video and filtering out mature content during searches. 

Here is exactly how you can implement both to achieve your goal.

### 1. Checking if a specific video is age-restricted
To check if a user-provided video link is 18+, you will use the **`Videos.list`** endpoint. 

When you make the request, you must include `contentDetails` in the `part` parameter. The API will return a `contentRating` object within the video's details. If YouTube has flagged the video as age-restricted, this object will contain a `ytRating` property set to `"ytAgeRestricted"`.

**API Request:**
`GET https://youtube.googleapis.com/youtube/v3/videos?part=contentDetails&id={VIDEO_ID}&key={YOUR_API_KEY}`

**What to look for in the JSON response:**
```json
{
  "items": [
    {
      "id": "VIDEO_ID",
      "contentDetails": {
        "contentRating": {
          "ytRating": "ytAgeRestricted"
        }
      }
    }
  ]
}
```
*Note: If the video is completely family-friendly or has no specific age-rating data, the `contentRating` object will usually be empty (`{}`). Always check for the explicit presence of `"ytAgeRestricted"`.*

### 2. Filtering out age-restricted videos in search
To prevent users from finding 18+ content through your app's search feature, you will use the **`Search.list`** endpoint and apply the `safeSearch` parameter.

The `safeSearch` parameter acts as a built-in content filter and accepts three values: `none`, `moderate` (the default), and `strict`.

**API Request:**
`GET https://youtube.googleapis.com/youtube/v3/search?part=snippet&q={SEARCH_QUERY}&safeSearch=strict&key={YOUR_API_KEY}`

**How `safeSearch` values work:**
* **`strict`**: YouTube will try to exclude all restricted content from the search results. **This is the setting you want to use.**
* **`moderate`**: (Default) Filters content restricted in the user's locale, but may still let some mature-leaning content through. 
* **`none`**: Returns all results, including 18+ content.

### A Quick Word on Reliability
While these API features are exactly what you need, it's worth noting that YouTube's filtering relies on both algorithmic detection and manual flagging. 
* **Search:** `safeSearch=strict` is highly effective but not entirely bulletproof against brand-new videos that haven't been caught by YouTube's safety filters yet. 
* **Direct Links:** Occasionally, an edge-case video might require sign-in to view on YouTube but won't properly return the `ytAgeRestricted` flag in the API. If your application handles embeds, age-restricted videos will simply refuse to play in the iframe, displaying an error to the user instead of exposing them to the content. 

Would you like a quick code example in Python or JavaScript showing how to parse the `contentRating` response?