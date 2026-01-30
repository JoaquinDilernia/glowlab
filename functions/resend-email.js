// Script para reenviar email de gift card
const fetch = require('node-fetch');

const GIFT_CARD_CODE = 'GIFT-E2948410';
const RECIPIENT_EMAIL = 'jdilernia99@gmail.com';

async function resendEmail() {
  try {
    console.log(`📧 Reenviando email para gift card: ${GIFT_CARD_CODE}`);
    
    const response = await fetch('https://apipromonube-jlfopowzaq-uc.a.run.app/api/giftcards/resend-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: GIFT_CARD_CODE,
        recipientEmail: RECIPIENT_EMAIL
      })
    });
    
    const result = await response.json();
    console.log('Resultado:', result);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

resendEmail();
