export default function handler(request, response) {
  const config = {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    supabasePublishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '',
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'https://languagebrain.vercel.app'
  };

  response.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  response.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300');
  response.status(200).send(`window.LANGUAGE_BRAIN_CONFIG=${JSON.stringify(config)};`);
}
