// wait.js - Waits for Supabase to be ready
(function() {
    window.waitForSupabase = function() {
        return new Promise((resolve) => {
            if (window.supabase && window.supabaseReady) {
                resolve(window.supabase);
                return;
            }
            
            const checkInterval = setInterval(() => {
                if (window.supabase && window.supabaseReady) {
                    clearInterval(checkInterval);
                    resolve(window.supabase);
                }
            }, 50);
            
            setTimeout(() => {
                clearInterval(checkInterval);
                console.error('Supabase timeout');
                resolve(null);
            }, 5000);
        });
    };
    
    console.log('✅ wait.js loaded');
})();