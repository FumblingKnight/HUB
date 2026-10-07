const ENDPOINT = 'https://graphql.anilist.co';
const CACHE_PREFIX = 'sajo_anilist_cache_v2:';

export async function gql(query, variables = {}, { cacheKey, ttl = 0 } = {}) {
  if (cacheKey && ttl > 0) {
    const cached = readCache(cacheKey, ttl);
    if (cached) return cached;
  }

  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({ query, variables })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.errors?.length) {
    const message = payload.errors?.map(e => e.message).join(', ') || `AniList API ${response.status}`;
    throw new Error(message);
  }

  if (cacheKey && ttl > 0) writeCache(cacheKey, payload.data);
  return payload.data;
}

function readCache(key, ttl) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.at > ttl) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeCache(key, data) {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ at: Date.now(), data }));
  } catch {}
}

export async function getUser(username) {
  return gql(`
    query UserByName($name: String!) {
      User(name: $name) {
        id
        name
        siteUrl
        avatar { large medium }
        bannerImage
        statistics {
          anime { count meanScore minutesWatched episodesWatched }
          manga { count meanScore chaptersRead volumesRead }
        }
      }
    }
  `, { name: username }, { cacheKey: `user:${username}`, ttl: 30 * 60 * 1000 });
}

export async function getLists(userId) {
  return gql(`
    query Lists($userId: Int!) {
      anime: MediaListCollection(userId: $userId, type: ANIME) {
        lists {
          entries {
            id mediaId status progress score updatedAt repeat
            media {
              id type format status episodes chapters siteUrl
              title { userPreferred romaji english }
              coverImage { large medium color }
              bannerImage
              averageScore genres
              nextAiringEpisode { airingAt episode timeUntilAiring }
            }
          }
        }
      }
      manga: MediaListCollection(userId: $userId, type: MANGA) {
        lists {
          entries {
            id mediaId status progress score progressVolumes updatedAt repeat
            media {
              id type format status episodes chapters volumes siteUrl countryOfOrigin
              title { userPreferred romaji english }
              coverImage { large medium color }
              bannerImage
              averageScore genres
            }
          }
        }
      }
    }
  `, { userId }, { cacheKey: `lists:${userId}`, ttl: 4 * 60 * 1000 });
}

export async function getActivities(userId, page = 1, perPage = 50) {
  return gql(`
    query UserActivity($userId: Int!, $page: Int!, $perPage: Int!) {
      Page(page: $page, perPage: $perPage) {
        pageInfo { currentPage hasNextPage }
        activities(userId: $userId, sort: ID_DESC) {
          ... on ListActivity {
            id type status progress createdAt replyCount likeCount siteUrl
            media {
              id type format siteUrl
              title { userPreferred romaji english }
              coverImage { large medium color }
            }
          }
        }
      }
    }
  `, { userId, page, perPage }, { cacheKey: `activities:${userId}:${page}:${perPage}`, ttl: 2 * 60 * 1000 });
}

export async function getAiringWeek(mediaIds, startSeconds, endSeconds) {
  if (!mediaIds?.length) return { Page: { airingSchedules: [] } };
  return gql(`
    query AiringWeek($ids: [Int], $start: Int, $end: Int) {
      Page(page: 1, perPage: 50) {
        airingSchedules(
          mediaId_in: $ids
          airingAt_greater: $start
          airingAt_lesser: $end
          sort: TIME
        ) {
          id airingAt episode mediaId
          media {
            id type format siteUrl
            title { userPreferred romaji english }
            coverImage { medium large color }
          }
        }
      }
    }
  `, { ids: mediaIds, start: startSeconds, end: endSeconds }, { cacheKey: `week:${startSeconds}:${endSeconds}:${mediaIds.join(',')}`, ttl: 10 * 60 * 1000 });
}

export async function getMediaDetail(mediaId, userId) {
  return gql(`
    query MediaDetail($mediaId: Int!, $userId: Int!) {
      Media(id: $mediaId) {
        id type format status source season seasonYear episodes chapters volumes duration
        siteUrl bannerImage description(asHtml: false)
        title { userPreferred romaji english native }
        coverImage { extraLarge large color }
        averageScore meanScore popularity favourites genres
        studios(isMain: true) { nodes { id name siteUrl } }
        nextAiringEpisode { airingAt episode timeUntilAiring }
        relations {
          edges { relationType(version: 2) }
          nodes {
            id type format siteUrl
            title { userPreferred }
            coverImage { large color }
          }
        }
      }
      MediaList(mediaId: $mediaId, userId: $userId) {
        id status progress progressVolumes score repeat notes updatedAt startedAt { year month day } completedAt { year month day }
      }
      Page(page: 1, perPage: 25) {
        activities(userId: $userId, mediaId: $mediaId, sort: ID_DESC) {
          ... on ListActivity { id status progress createdAt siteUrl likeCount replyCount }
        }
      }
    }
  `, { mediaId, userId }, { cacheKey: `media:${mediaId}:${userId}`, ttl: 5 * 60 * 1000 });
}
