const express = require('express');
const { getPosts, getPostsCount } = require('../../utils/storage');
const { logger } = require('../../utils/logger');

const posts = express.Router();

posts.get('/', async (req, res) => {
  const defaultNumberOfPosts = 30;
  const capNumOfPosts = 100;
  const page = parseInt(req.query.page || 1, 10);

  let guids;
  let perPage;
  let postsCount;
  let from;
  let to;

  /**
   * Set 'perPage' to a value within the limits or
   * to default if per_page is not present
   */
  if (req.query.per_page)
    perPage = req.query.per_page > capNumOfPosts ? capNumOfPosts : req.query.per_page;
  else perPage = defaultNumberOfPosts;

  try {
    postsCount = await getPostsCount();

    /**
     * Set the range of posts that will be requested
     * {from, to}
     */
    from = perPage * (page - 1);
    // Make sure the upper limit is not higher than the total number of posts in the DB
    to = perPage * page > postsCount ? postsCount : perPage * page;

    guids = await getPosts(from, to);
  } catch (err) {
    logger.error({ err }, 'Unable to get posts from Redis');
    res.status(503).json({
      message: 'Unable to connect to database',
    });
    return;
  }

  /**
   * Add prev, next, first and last in the response's header.
   * It's been implemented to work circularly.
   * Once reached the last set of posts, 'next' points at the first set.
   * Same case with 'prev' and the first set of posts.
   */
  const nextPage = to >= postsCount ? 1 : page + 1;
  const prevPage = from === 0 ? Math.floor(postsCount / perPage) : page - 1;

  res.links({
    next: `/posts?per_page=${perPage}&page=${nextPage}`,
    prev: `/posts?per_page=${perPage}&page=${prevPage}`,
    first: `/posts?per_page=${perPage}&page=${1}`,
    last: `/posts?per_page=${perPage}&page=${Math.floor(postsCount / perPage)}`,
  });
  res.json(
    guids
      // Return id and url for a specific post
      .map(guid => ({
        id: guid,
        url: `/post/${encodeURIComponent(guid)}`,
      }))
  );
});

posts.get('/count', async (req, res) => {
  try {
    const count = await getPostsCount();
    res.json(count);
  } catch (err) {
    logger.error({ err }, 'Unable to get posts from Redis');
    res.status(500).json({
      message: 'Unable to connect to database',
    });
  }
});

module.exports = posts;
