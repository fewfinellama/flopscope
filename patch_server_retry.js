import fs from 'fs';
let server = fs.readFileSync('server.js', 'utf8');

const targetStr = `  // 3. Upstream Fetch
  try {
    const roomResult = await proxy.fetchRoom(room, since, limit);

    // Save in Cache and Persistent SQLite Archive
    cache.set(cacheKey, roomResult, CACHE_TTL_MS);
    if (roomResult.data && roomResult.data.length > 0) {
      try {
        db.saveMessages(room, roomResult.data);
      } catch (dbErr) {
        console.error('Failed to archive messages:', dbErr);
      }
    }

    res.json({
      room,
      cached: false,
      ageMs: 0,
      ...roomResult,
    });
  } catch (err) {
    next(err);
  }
});`;

const replacementStr = `  // 3. Upstream Fetch with Retry Logic
  let lastErr = null;
  const maxRetries = 2;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const roomResult = await proxy.fetchRoom(room, since, limit);

      // Save in Cache and Persistent SQLite Archive
      cache.set(cacheKey, roomResult, CACHE_TTL_MS);
      if (roomResult.data && roomResult.data.length > 0) {
        try {
          db.saveMessages(room, roomResult.data);
        } catch (dbErr) {
          console.error('Failed to archive messages:', dbErr);
        }
      }

      return res.json({
        room,
        cached: false,
        ageMs: 0,
        ...roomResult,
      });
    } catch (err) {
      lastErr = err;
      if (attempt < maxRetries) {
        // Wait 500ms before retrying
        await new Promise((r) => setTimeout(r, 500));
      }
    }
  }
  
  // All retries failed, pass error to central error handler
  next(lastErr);
});`;

server = server.replace(targetStr, replacementStr);
fs.writeFileSync('server.js', server);
