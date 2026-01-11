
import { Booking } from '../types';

/**
 * Encodes a string to base64url format as required by Gmail API.
 */
function base64urlEncode(str: string): string {
    return btoa(unescape(encodeURIComponent(str)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

/**
 * Sends a booking confirmation email via the Gmail API.
 */
export async function sendBookingConfirmationEmail(accessToken: string, booking: Booking, userEmail: string): Promise<void> {
    const isP2P = booking.type === 'p2p';
    
    const subject = isP2P 
        ? `[AIVoiceCast] Mentorship Request: ${booking.mentorName}` 
        : `[AIVoiceCast] AI Session Confirmed: ${booking.mentorName}`;

    const body = `
Hello ${booking.hostName},

${isP2P 
    ? `Your request to book a session with ${booking.mentorName} has been sent.` 
    : `Your interactive session with AI Mentor ${booking.mentorName} is confirmed.`}

SESSION DETAILS:
------------------------------------------
Topic: ${booking.topic}
Date: ${booking.date}
Time: ${booking.time} (Duration: ${booking.duration}m)
Ends: ${booking.endTime}
------------------------------------------

You can join this session from your "Schedule" tab in the AIVoiceCast Mentorship Hub.

Happy Learning,
The AIVoiceCast Neural OS
    `.trim();

    const email = [
        `To: ${userEmail}`,
        `Subject: ${subject}`,
        'Content-Type: text/plain; charset="UTF-8"',
        '',
        body
    ].join('\r\n');

    const raw = base64urlEncode(email);

    try {
        const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ raw })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error?.message || "Gmail API failed to send email.");
        }
        
        console.log("[Gmail] Confirmation email sent successfully.");
    } catch (error) {
        console.error("[Gmail] Failed to send email:", error);
        // We don't block the UI for email failures, just log them.
    }
}
