import { defineMiddlewares } from "@medusajs/framework/http";

/**
 * Custom CORS middleware to handle dynamic origin validation.
 * 
 * Allows:
 * 1. Exact matches from STORE_CORS env variable
 * 2. Any origin ending with -karl-bjarnos-projects.vercel.app (Vercel preview deployments)
 */

// Parse allowed origins once at startup
const allowedOrigins = process.env.STORE_CORS?.split(',').map(s => s.trim()) || [];

export default defineMiddlewares({
  routes: [
    {
      matcher: "/store/*",
      middlewares: [
        (req, res, next) => {
          const origin = req.headers.origin;
          
          if (!origin) {
            return next();
          }

          // Check exact match
          if (allowedOrigins.includes(origin)) {
            res.setHeader('Access-Control-Allow-Origin', origin);
            res.setHeader('Access-Control-Allow-Credentials', 'true');
            return next();
          }
          
          // Check Vercel preview deployment pattern
          if (origin.endsWith('-karl-bjarnos-projects.vercel.app')) {
            res.setHeader('Access-Control-Allow-Origin', origin);
            res.setHeader('Access-Control-Allow-Credentials', 'true');
            return next();
          }

          // Not allowed - let default CORS handling reject it
          next();
        },
      ],
    },
  ],
});
