// storage.js — BreedLink image/file upload helpers
const StorageAPI = {
    async uploadImage(file, bucket) {
        console.log(`📤 Uploading to ${bucket}:`, file.name);

        if (!window.supabase) throw new Error('Supabase not available');

        // Resolve userId — try User.current, then localStorage, then Supabase auth
        let userId = null;

        if (window.User && window.User.current && window.User.current.id) {
            userId = window.User.current.id;
        }

        if (!userId) {
            try {
                const str = localStorage.getItem('breedlink_user');
                if (str) {
                    const u = JSON.parse(str);
                    if (u && u.id && u.id !== 'null' && u.id !== 'undefined') {
                        userId = u.id;
                    }
                }
            } catch (e) {}
        }

        // Last resort: fetch from Supabase auth endpoint directly
        if (!userId) {
            try {
                const { data } = await window.supabase.auth.getUser();
                userId = data?.user?.id || null;
            } catch (e) {}
        }

        if (!userId) {
            throw new Error('Not authenticated — please log out and log back in');
        }

        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 8);
        const fileExt = file.name.split('.').pop().toLowerCase();
        const fileName = `${timestamp}_${randomStr}.${fileExt}`;
        const filePath = `${userId}/${fileName}`;

        console.log('Upload path:', filePath);

        const { error } = await window.supabase.storage
            .from(bucket)
            .upload(filePath, file, { upsert: true });

        if (error) throw error;

        const { data } = window.supabase.storage.from(bucket).getPublicUrl(filePath);
        console.log('Uploaded URL:', data.publicUrl);
        return data.publicUrl;
    },

    async uploadProfilePicture(file) { return this.uploadImage(file, 'avatars'); },
    async uploadCoverPhoto(file)     { return this.uploadImage(file, 'covers'); },
    async uploadAnimalImage(file)    { return this.uploadImage(file, 'animals'); },
    async uploadPostImage(file)      { return this.uploadImage(file, 'posts'); },
    async uploadMessageImage(file)   { return this.uploadImage(file, 'messages'); },
    async uploadAnimalDocument(file)  { return this.uploadDocument(file); },

    async uploadDocument(file) {
        const bucket = 'documents';
        if (!window.supabase) throw new Error('Supabase not available');

        let userId = null;
        if (window.User && window.User.current && window.User.current.id) {
            userId = window.User.current.id;
        }
        if (!userId) {
            try {
                const { data } = await window.supabase.auth.getUser();
                userId = data?.user?.id || null;
            } catch (e) {}
        }
        if (!userId) throw new Error('Please log in first');

        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 8);
        const fileExt = file.name.split('.').pop().toLowerCase();
        const filePath = `${userId}/${timestamp}_${randomStr}.${fileExt}`;

        const { error } = await window.supabase.storage
            .from(bucket)
            .upload(filePath, file, { upsert: true });

        if (error) throw error;

        const { data } = window.supabase.storage.from(bucket).getPublicUrl(filePath);
        return { url: data.publicUrl, name: file.name, type: file.type, size: file.size };
    }
};

window.StorageAPI = StorageAPI;
console.log('✅ StorageAPI ready');
