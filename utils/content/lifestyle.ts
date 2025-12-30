import { SpotlightChannelData } from '../spotlightContent';

export const LIFESTYLE_CONTENT: Record<string, SpotlightChannelData> = {
  // Longevity & Biohacking (health-101)
  'health-101': {
    curriculum: [
      {
        id: 'hl-ch1',
        title: 'Nutrition & Metabolism',
        subTopics: [
          { id: 'hl-1-1', title: 'Intermittent Fasting Mechanics' },
          { id: 'hl-1-2', title: 'Ketosis vs Glycolysis' },
          { id: 'hl-1-3', title: 'Protein Intake for Sarcopenia' }
        ]
      },
      {
        id: 'hl-ch2',
        title: 'Exercise Physiology',
        subTopics: [
          { id: 'hl-2-1', title: 'Zone 2 Cardio Explained' },
          { id: 'hl-2-2', title: 'VO2 Max as a Vital Sign' },
          { id: 'hl-2-3', title: 'Strength Training for Bone Density' }
        ]
      },
      {
        id: 'hl-ch3',
        title: 'Restoration',
        subTopics: [
          { id: 'hl-3-1', title: 'Sleep Hygiene Protocols' },
          { id: 'hl-3-2', title: 'Heat & Cold Exposure (Sauna/Ice)' },
          { id: 'hl-3-3', title: 'Stress & Cortisol Management' }
        ]
      }
    ],
    lectures: {
      "Zone 2 Cardio Explained": {
        topic: "Zone 2 Cardio Explained",
        professorName: "Dr. Peter Attia",
        studentName: "Athlete",
        sections: [
          { speaker: "Teacher", text: "Most people exercise too hard on their easy days and too easy on their hard days. Zone 2 is the foundation of metabolic health." },
          { speaker: "Student", text: "What exactly is Zone 2?" },
          { speaker: "Teacher", text: "It's the intensity where your mitochondria are most efficient at oxidizing fat. You should be able to hold a conversation, but it should feel slightly strained. If you can speak in full paragraphs, it's too easy. If you can only say a few words, it's Zone 3." },
          { speaker: "Student", text: "Why does it matter?" },
          { speaker: "Teacher", text: "Because it builds mitochondrial density. This improves your ability to clear lactate. If you skip Zone 2 and only do HIIT, you become a 'glycolytic beast' but have poor metabolic flexibility." }
        ]
      }
    }
  },

  // Relationship Coach (rel-101)
  'rel-101': {
    curriculum: [
      {
        id: 'rel-ch1',
        title: 'Conflict Resolution',
        subTopics: [
          { id: 'rel-1-1', title: 'The Four Horsemen (Gottman)' },
          { id: 'rel-1-2', title: 'Active Listening Techniques' },
          { id: 'rel-1-3', title: 'Repair Attempts' }
        ]
      },
      {
        id: 'rel-ch2',
        title: 'Deepening Connection',
        subTopics: [
          { id: 'rel-2-1', title: 'Love Languages Explained' },
          { id: 'rel-2-2', title: 'Building Love Maps' },
          { id: 'rel-2-3', title: 'Vulnerability & Trust' }
        ]
      }
    ],
    lectures: {
      "Active Listening Techniques": {
        topic: "Active Listening Techniques",
        professorName: "Therapist",
        studentName: "Partner",
        sections: [
          { speaker: "Teacher", text: "Listening is not just waiting for your turn to speak. It is about validation. When your partner is upset, do not try to fix the problem immediately." },
          { speaker: "Student", text: "But I want to help them!" },
          { speaker: "Teacher", text: "The best help is feeling understood. Say: 'It makes sense that you feel that way because...' Reflect their emotion back to them. Once the emotion is processed, the logic brain comes back online, and then you can problem-solve together." }
        ]
      }
    }
  },

  // True Crime (crime-101)
  'crime-101': {
    curriculum: [
      {
        id: 'cr-ch1',
        title: 'Famous Serial Killers',
        subTopics: [
          { id: 'cr-1-1', title: 'The Golden State Killer' },
          { id: 'cr-1-2', title: 'Ted Bundy: The Chameleon' },
          { id: 'cr-1-3', title: 'Jack the Ripper Theories' }
        ]
      },
      {
        id: 'cr-ch2',
        title: 'Forensic Science',
        subTopics: [
          { id: 'cr-2-1', title: 'Genetic Genealogy Breakthroughs' },
          { id: 'cr-2-2', title: 'Ballistics & Striations' },
          { id: 'cr-2-3', title: 'Digital Forensics' }
        ]
      }
    ],
    lectures: {
      "The Golden State Killer": {
        topic: "The Golden State Killer",
        professorName: "Detective",
        studentName: "Journalist",
        sections: [
          { speaker: "Teacher", text: "For decades, he was a phantom. The Visalia Ransacker, the East Area Rapist, the Original Night Stalker. Police didn't know these were all the same man until DNA connected them." },
          { speaker: "Student", text: "How did they finally catch him?" },
          { speaker: "Teacher", text: "GEDmatch. They took crime scene DNA and uploaded it to a public genealogy database. They found distant cousins—third or fourth cousins. Then they built a massive family tree backward and forward until they narrowed it down to one branch: Joseph James DeAngelo." },
          { speaker: "Student", text: "He was a cop?" },
          { speaker: "Teacher", text: "Yes. That explains how he knew police tactics, how to avoid fingerprints, and how to track victims. It was the ultimate betrayal of public trust." }
        ]
      }
    }
  },

  // Pop Culture (pop-101)
  'pop-101': {
    curriculum: [
      {
        id: 'pop-ch1',
        title: 'Cinema Trends',
        subTopics: [
          { id: 'pop-1-1', title: 'The Death of the Movie Star' },
          { id: 'pop-1-2', title: 'The Rise of A24 & Indie Horror' },
          { id: 'pop-1-3', title: 'Superhero Fatigue' }
        ]
      },
      {
        id: 'pop-ch2',
        title: 'Music Industry',
        subTopics: [
          { id: 'pop-2-1', title: 'TikTok\'s Impact on Hit Songs' },
          { id: 'pop-2-2', title: 'The Vinyl Revival' },
          { id: 'pop-2-3', title: 'Streaming Economics' }
        ]
      }
    ],
    lectures: {
      "The Death of the Movie Star": {
        topic: "The Death of the Movie Star",
        professorName: "Film Critic",
        studentName: "Fan",
        sections: [
          { speaker: "Teacher", text: "In the 90s, you went to see a movie because Tom Cruise was in it. Today, you go to see a movie because it's a Marvel movie. The IP (Intellectual Property) has become the star, not the actor." },
          { speaker: "Student", text: "Is that bad?" },
          { speaker: "Teacher", text: "It shifts the power dynamic. Actors are replaceable. The costume matters more than the person wearing it. This is why we see fewer mid-budget dramas and comedies. The studio bets on the franchise, not the charisma of a lead." }
        ]
      }
    }
  },

  // Travel (travel-101)
  'travel-101': {
    curriculum: [
      {
        id: 'tr-ch1',
        title: 'Travel Tactics',
        subTopics: [
          { id: 'tr-1-1', title: 'One Bag Travel Philosophy' },
          { id: 'tr-1-2', title: 'Travel Hacking: Points & Miles' },
          { id: 'tr-1-3', title: 'Digital Nomad Visas' }
        ]
      },
      {
        id: 'tr-ch2',
        title: 'Destinations',
        subTopics: [
          { id: 'tr-2-1', title: 'Hidden Gems of Southeast Asia' },
          { id: 'tr-2-2', title: 'Van Life in New Zealand' },
          { id: 'tr-2-3', title: 'Cultural Etiquette in Japan' }
        ]
      }
    ],
    lectures: {
      "One Bag Travel Philosophy": {
        topic: "One Bag Travel Philosophy",
        professorName: "Nomad",
        studentName: "Tourist",
        sections: [
          { speaker: "Teacher", text: "The more you carry, the heavier your burden—literally and mentally. One Bag travel is about freedom. No checked bags. No waiting at carousels. No lost luggage." },
          { speaker: "Student", text: "But how do I fit everything for a month?" },
          { speaker: "Teacher", text: "Merino wool. It doesn't smell, so you can wear a shirt 3-4 times before washing. You do laundry in the sink. You pack for a week, not a month. And you realize you need far less than you think to be happy." }
        ]
      }
    }
  }
};