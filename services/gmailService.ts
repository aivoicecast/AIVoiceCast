
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
 * Supports different templates for the Host and the Mentor.
 */
export async function sendBookingEmail(
    accessToken: string, 
    booking: Booking, 
    recipientEmail: string,
    recipientName: string,
    isHost: boolean
): Promise<void> {
    const isP2P = booking.type === 'p2p';
    
    // Determine Subject
    let subject = '';
    if (isHost) {
        subject = isP2P 
            ? `[AIVoiceCast] Mentorship Request Sent: ${booking.mentorName}` 
            : `[AIVoiceCast] AI Session Confirmed: ${booking.mentorName}`;
    } else {
        subject = `[AIVoiceCast] New Mentorship Request from ${booking.hostName}`;
    }

    // Determine Body
    const intro = isHost 
        ? `Hello ${recipientName}, your request to book a session with ${booking.mentorName} is being processed.`
        : `Hello ${recipientName}, ${booking.hostName} has requested a mentorship session with you.`;

    const statusNote = isHost
        ? (isP2P ? "This request is pending mentor approval." : "This AI session is confirmed.")
        : "Please log in to AIVoiceCast to Accept or Decline this request in your Notifications tab.";

    const body = `
${intro}

${statusNote}

SESSION DETAILS:
------------------------------------------
Topic: ${booking.topic}
Date: ${booking.date}
Time: ${booking.time} (Duration: ${booking.duration}m)
Ends: ${booking.endTime}
------------------------------------------

You can manage your sessions in the "Mentorship Hub" within the AIVoiceCast Neural OS.

Happy Learning,
The AIVoiceCast Neural OS
    `.trim();

    const email = [
        `To: ${recipientEmail}`,
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
        
        console.log(`[Gmail] Email sent successfully to ${recipientEmail}`);
    } catch (error) {
        console.error(`[Gmail] Failed to send email to ${recipientEmail}:`, error);
    }
}
