
import { SpotlightChannelData } from '../spotlightContent';

export const STARTUP_CONTENT: Record<string, SpotlightChannelData> = {
  'startup-funding-30': {
    curriculum: [
      {
        id: 'sf-ch1',
        title: 'Chapter 1: Bootstrapping & Self-Funding',
        subTopics: [
          { id: 'sf-1-1', title: 'Personal Savings & Risk Tolerance' },
          { id: 'sf-1-2', title: 'The "Friends & Family" Round' },
          { id: 'sf-1-3', title: 'Credit Cards & Personal Loans (High Risk)' },
          { id: 'sf-1-4', title: 'Customer-Funded Growth (Pre-sales)' },
          { id: 'sf-1-5', title: 'Service-First Business Models' },
          { id: 'sf-1-6', title: 'Bartering Services for Equity' },
          { id: 'sf-1-7', title: 'Sweat Equity: Work now, Pay later' }
        ]
      },
      {
        id: 'sf-ch2',
        title: 'Chapter 2: Angel Investors',
        subTopics: [
          { id: 'sf-2-1', title: 'Who are Angel Investors?' },
          { id: 'sf-2-2', title: 'Finding Angels: AngelList & Networks' },
          { id: 'sf-2-3', title: 'The Pitch Deck Essentials' },
          { id: 'sf-2-4', title: 'Valuation at Pre-Seed' },
          { id: 'sf-2-5', title: 'Due Diligence Checklist' },
          { id: 'sf-2-6', title: 'The "Lead" Investor' },
          { id: 'sf-2-7', title: 'Advisory Shares vs Investment' }
        ]
      },
      {
        id: 'sf-ch3',
        title: 'Chapter 3: Accelerators & Incubators',
        subTopics: [
          { id: 'sf-3-1', title: 'Y Combinator: The Gold Standard' },
          { id: 'sf-3-2', title: 'Techstars & 500 Startups' },
          { id: 'sf-3-3', title: 'Equity Costs of Accelerators' },
          { id: 'sf-3-4', title: 'The "Demo Day" Effect' },
          { id: 'sf-3-5', title: 'Incubators vs Accelerators' },
          { id: 'sf-3-6', title: 'University Based Programs' },
          { id: 'sf-3-7', title: 'Corporate Incubators' }
        ]
      },
      {
        id: 'sf-ch4',
        title: 'Chapter 4: Venture Capital (VC) Basics',
        subTopics: [
          { id: 'sf-4-1', title: 'How VCs Make Money (2 and 20)' },
          { id: 'sf-4-2', title: 'The Power Law Distribution' },
          { id: 'sf-4-3', title: 'Stages: Seed vs Series A vs Series B' },
          { id: 'sf-4-4', title: 'The Term Sheet: Economics vs Control' },
          { id: 'sf-4-5', title: 'Liquidation Preferences Explained' },
          { id: 'sf-4-6', title: 'Board Seats & Voting Rights' },
          { id: 'sf-4-7', title: 'Anti-Dilution Provisions' }
        ]
      },
      {
        id: 'sf-ch5',
        title: 'Chapter 5: Investment Instruments',
        subTopics: [
          { id: 'sf-5-1', title: 'Convertible Notes' },
          { id: 'sf-5-2', title: 'SAFEs (Simple Agreement for Future Equity)' },
          { id: 'sf-5-3', title: 'Valuation Caps & Discounts' },
          { id: 'sf-5-4', title: 'Post-Money vs Pre-Money SAFEs' },
          { id: 'sf-5-5', title: 'Common vs Preferred Stock' },
          { id: 'sf-5-6', title: 'Warrants and Options' },
          { id: 'sf-5-7', title: 'KISS Documents' }
        ]
      },
      {
        id: 'sf-ch6',
        title: 'Chapter 6: Alternative Debt Financing',
        subTopics: [
          { id: 'sf-6-1', title: 'Venture Debt' },
          { id: 'sf-6-2', title: 'Revenue-Based Financing (RBF)' },
          { id: 'sf-6-3', title: 'Factoring (Accounts Receivable)' },
          { id: 'sf-6-4', title: 'Merchant Cash Advances (MCA)' },
          { id: 'sf-6-5', title: 'Equipment Leasing' },
          { id: 'sf-6-6', title: 'SBA Loans (7a and 504)' },
          { id: 'sf-6-7', title: 'Lines of Credit' }
        ]
      },
      {
        id: 'sf-ch7',
        title: 'Chapter 7: Crowdfunding',
        subTopics: [
          { id: 'sf-7-1', title: 'Rewards Crowdfunding (Kickstarter)' },
          { id: 'sf-7-2', title: 'Equity Crowdfunding (Reg CF)' },
          { id: 'sf-7-3', title: 'Marketing a Campaign' },
          { id: 'sf-7-4', title: 'Managing Backers' },
          { id: 'sf-7-5', title: 'Success Stories vs Failures' },
          { id: 'sf-7-6', title: 'Legal Limits of Reg CF' },
          { id: 'sf-7-7', title: 'Patreon & Subscription Models' }
        ]
      },
      {
        id: 'sf-ch8',
        title: 'Chapter 8: Government & Non-Dilutive',
        subTopics: [
          { id: 'sf-8-1', title: 'SBIR / STTR Grants' },
          { id: 'sf-8-2', title: 'R&D Tax Credits' },
          { id: 'sf-8-3', title: 'University Grants' },
          { id: 'sf-8-4', title: 'Non-Profit Grants' },
          { id: 'sf-8-5', title: 'Competitions and Hackathons' },
          { id: 'sf-8-6', title: 'State Economic Development Funds' },
          { id: 'sf-8-7', title: 'Grant Writing 101' }
        ]
      },
      {
        id: 'sf-ch9',
        title: 'Chapter 9: Advanced & Exit Strategy',
        subTopics: [
          { id: 'sf-9-1', title: 'Private Equity (PE) Buyouts' },
          { id: 'sf-9-2', title: 'IPO (Initial Public Offering)' },
          { id: 'sf-9-3', title: 'SPACs (Special Purpose Acquisition Corps)' },
          { id: 'sf-9-4', title: 'Secondary Markets (Selling Founder Shares)' },
          { id: 'sf-9-5', title: 'M&A: The Acqui-hire' },
          { id: 'sf-9-6', title: 'Direct Listings' },
          { id: 'sf-9-7', title: 'Bankruptcy & Liquidation' }
        ]
      },
      {
        id: 'sf-ch10',
        title: 'Chapter 10: Crypto & Web3 Funding',
        subTopics: [
          { id: 'sf-10-1', title: 'ICO (Initial Coin Offering) History' },
          { id: 'sf-10-2', title: 'Tokenomics Basics' },
          { id: 'sf-10-3', title: 'DAOs (Decentralized Autonomous Orgs)' },
          { id: 'sf-10-4', title: 'NFT Sales for Funding' },
          { id: 'sf-10-5', title: 'SAFT (Simple Agreement for Future Tokens)' },
          { id: 'sf-10-6', title: 'Community Treasuries' },
          { id: 'sf-10-7', title: 'Regulatory Risks (SEC)' }
        ]
      }
    ],
    lectures: {
      "Personal Savings & Risk Tolerance": {
        topic: "Personal Savings & Risk Tolerance",
        professorName: "Finance Mentor",
        studentName: "Founder",
        sections: [
          { speaker: "Teacher", text: "The most common way to fund a startup is your own bank account. It's called Bootstrapping. It gives you 100% control, but 100% risk." },
          { speaker: "Student", text: "How much should I invest?" },
          { speaker: "Teacher", text: "Only what you can afford to lose. You must calculate your 'Burn Rate'—your monthly living expenses. If you have $50k savings and burn $5k/month, you have exactly 10 months of runway." },
          { speaker: "Student", text: "What happens if I run out?" },
          { speaker: "Teacher", text: "You go out of business, or worse, you accumulate personal debt. That is why 'Customer-Funded Growth' is superior. Get customers to pay you upfront before you build the product." },
          { speaker: "Student", text: "But I need money to build the product first!" },
          { speaker: "Teacher", text: "Do you? Can you sell a service first? Can you sell a PDF? Can you pre-sell a prototype? Service revenue is non-dilutive capital. It validates the market and funds the product development." },
          { speaker: "Student", text: "So I should consult on the side?" },
          { speaker: "Teacher", text: "If it aligns with your product vision, yes. Many SaaS companies started as agencies. You build a custom tool for a client, then realize other clients need it too. Then you productize it." },
          { speaker: "Student", text: "That sounds slower than raising VC." },
          { speaker: "Teacher", text: "It is slower. But you keep 100% of the equity. And when you do raise money later, you have revenue, which gives you leverage. Investors love leverage." },
          { speaker: "Student", text: "Leverage gets a better valuation." },
          { speaker: "Teacher", text: "Exactly. Desperation smells. Revenue smells like success." }
        ]
      },
      "Convertible Notes vs SAFEs": {
        topic: "Convertible Notes vs SAFEs",
        professorName: "Legal Expert",
        studentName: "Founder",
        sections: [
          { speaker: "Teacher", text: "Early stage fundraising usually uses instruments that delay valuation. Two main types: Convertible Notes and SAFEs." },
          { speaker: "Student", text: "What is a SAFE?" },
          { speaker: "Teacher", text: "Simple Agreement for Future Equity. Invented by Y Combinator. It's not debt. It has no interest rate and no maturity date. It just converts to equity at the next priced round." },
          { speaker: "Student", text: "And a Note?" },
          { speaker: "Teacher", text: "A Convertible Note is debt. It has an interest rate (e.g. 5%) and a maturity date. If you don't raise money by the date, technically you are in default." },
          { speaker: "Student", text: "So why would anyone use a Note?" },
          { speaker: "Teacher", text: "Investors sometimes prefer it because it's safer for them. They are creditors. If you go bankrupt, they get paid before equity holders. But on the West Coast, SAFEs are the standard." },
          { speaker: "Student", text: "What about the Cap?" },
          { speaker: "Teacher", text: "The Valuation Cap is critical. It protects the early investor. If you give me a SAFE with a $5M Cap, and you later raise at $20M, I get to convert my money as if the value was only $5M." },
          { speaker: "Student", text: "So you get 4x more shares?" },
          { speaker: "Teacher", text: "Roughly, yes. It rewards me for taking the early risk. Without a Cap, an early investor might own a tiny % if you become a unicorn overnight." },
          { speaker: "Student", text: "Is there a downside for me?" },
          { speaker: "Teacher", text: "Dilution. If you stack too many SAFEs with low caps, you might sell 40% of your company before you even get to Series A. You need to model the conversion math carefully." }
        ]
      }
    }
  }
};
