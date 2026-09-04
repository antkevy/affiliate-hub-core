CREATE POLICY "storage_own_folder_select" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id IN ('avatars','offer-media','banners','logos') AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "storage_own_folder_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id IN ('avatars','offer-media','banners','logos') AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "storage_own_folder_update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id IN ('avatars','offer-media','banners','logos') AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id IN ('avatars','offer-media','banners','logos') AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "storage_own_folder_delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id IN ('avatars','offer-media','banners','logos') AND (storage.foldername(name))[1] = auth.uid()::text);