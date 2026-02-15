
-- Allow authenticated users to upload credor logos to the avatars bucket
CREATE POLICY "Authenticated users can upload credor logos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = 'credor-logos');

-- Allow authenticated users to update (upsert) credor logos
CREATE POLICY "Authenticated users can update credor logos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = 'credor-logos');
