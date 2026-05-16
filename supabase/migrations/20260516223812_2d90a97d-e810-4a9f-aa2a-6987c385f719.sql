CREATE POLICY "Authenticated users can upload doc logos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = 'credor-doc-logos');

CREATE POLICY "Authenticated users can update doc logos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = 'credor-doc-logos');