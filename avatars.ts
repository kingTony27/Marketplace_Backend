// generate-avatars.ts
// Generates DiceBear pixelArt avatars locally and uploads them to a Supabase Storage bucket.
//
// Setup:
//   npm i @dicebear/core @dicebear/collection @supabase/supabase-js
//   npm i -D typescript tsx @types/node
//
// Run:
//   SUPABASE_URL=https://xxxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=xxxx npx tsx generate-avatars.ts
//
// IMPORTANT: use the service role key ONLY in this local script. Never ship it to the browser.

import { createAvatar } from '@dicebear/core';
import { pixelArt } from '@dicebear/collection';
import {supabase} from './lib/client.js';


const BUCKET = 'avatars';
const FOLDER = 'pixelArt';
const COUNT = 20; // how many avatars to generate

// Dark neon backgrounds, same as the crypto preview
const BACKGROUNDS: string[] = ['09090b', '18181b', '27272a', '3f3f46'];



async function main(): Promise<void> {


  for (let i = 1; i <= COUNT; i++) {
    const seed = `${FOLDER}-${i}`; // same seed = same avatar, always

    const svg = createAvatar(pixelArt, {
      seed,
      size: 256,
      backgroundColor: BACKGROUNDS,
    }).toString();

    const path = `${FOLDER}/${seed}.svg`;

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, svg, { contentType: 'image/svg+xml', upsert: true });

    if (error) console.error('Failed:', path, error.message);
    else console.log('Uploaded:', path);
  }
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});

// ---------------------------------------------------------------
// In your app (Supabase client, TypeScript):
//
//   const { data } = supabase.storage.from('avatars').getPublicUrl('pixelArt/pixelArt-1.svg');
//   const url: string = data.publicUrl;
//
// Or build the URL directly:
//   `${SUPABASE_URL}/storage/v1/object/public/avatars/pixelArt/pixelArt-1.svg`
//
// To list all avatars for the picker UI:
//   const { data: files } = await supabase.storage.from('avatars').list('pixelArt', { limit: 100 });
//
// Then save the chosen URL in the user's profile row (e.g. profiles.avatar_url).
// ---------------------------------------------------------------