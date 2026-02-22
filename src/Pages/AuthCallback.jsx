import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const platform = searchParams.get('platform');

  useEffect(() => {
    const handleCallback = async () => {
      // Supabase OAuth callback handling
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('OAuth callback error:', error);
        navigate('/auth?error=oauth_failed');
        return;
      }

      if (session?.user && platform === 'linkedin') {
        // LinkedIn profil bilgilerini al
        const linkedinId = session.user.user_metadata?.provider_id || 
                           session.user.user_metadata?.sub;
        
        // Profili güncelle - linkedin_link ve verified olarak işaretle
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            linkedin_link: linkedinId || session.user.email?.split('@')[0],
            linkedin_verified: true,
            show_linkedin: true
          })
          .eq('id', session.user.id);

        if (updateError) {
          console.error('Profile update error:', updateError);
        }

        // Auth sayfasına geri dön (step 3)
        navigate('/auth?step=3&linkedin_connected=true');
      } else {
        navigate('/auth');
      }
    };

    handleCallback();
  }, [navigate, platform]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600">Bağlanıyor...</p>
      </div>
    </div>
  );
}
