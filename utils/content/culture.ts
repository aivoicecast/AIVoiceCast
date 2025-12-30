
import { SpotlightChannelData } from '../spotlightContent';

export const CULTURE_CONTENT: Record<string, SpotlightChannelData> = {
  // Creative Spark (ID: 4)
  '4': {
    curriculum: [
      { id: 'cs-ch1', title: 'Ideation Techniques', subTopics: [{ id: 'cs-1-1', title: 'SCAMPER Method' }, { id: 'cs-1-2', title: 'Mind Mapping' }, { id: 'cs-1-3', title: 'Six Thinking Hats' }] },
      { id: 'cs-ch2', title: 'Storytelling', subTopics: [{ id: 'cs-2-1', title: 'The Hero\'s Journey' }, { id: 'cs-2-2', title: 'Three Act Structure' }, { id: 'cs-2-3', title: 'Character Archetypes' }] }
    ],
    lectures: {
      "The Hero's Journey": {
        topic: "The Hero's Journey",
        professorName: "Joseph Campbell",
        studentName: "Screenwriter",
        sections: [
          { speaker: "Teacher", text: "Today we dissect the Monomyth, known as The Hero's Journey. It is the narrative backbone of myths from 'The Odyssey' to 'Star Wars'. It consists of three main acts: Departure, Initiation, and Return." },
          { speaker: "Student", text: "Departure is leaving home, right? Like Frodo leaving the Shire." },
          { speaker: "Teacher", text: "Correct. It starts with the 'Call to Adventure'. Something disrupts the hero's Ordinary World. A message, a threat, or a discovery. But usually, the hero initially refuses. This is the 'Refusal of the Call'. They are afraid of change or duty." },
          { speaker: "Student", text: "So they need a push. Like Gandalf?" },
          { speaker: "Teacher", text: "Exactly. The 'Supernatural Aid' or Mentor figure appears to provide amulets or advice. This gives the hero courage to Cross the First Threshold. This is the point of no return. They enter the 'Belly of the Whale'—the Special World where the old rules don't apply." },
          { speaker: "Student", text: "What happens in the Special World? Is that just fighting monsters?" },
          { speaker: "Teacher", text: "That is the 'Road of Trials'. Tests, Allies, and Enemies. But deeply, it involves self-discovery. They often face the 'Meeting with the Goddess' (unconditional love) or the 'Woman as the Temptress' (distractions from the path)." },
          { speaker: "Student", text: "What is the climax?" },
          { speaker: "Teacher", text: "The 'Atonement with the Father'. It is the confrontation with the ultimate power or authority figure in their life. It leads to the 'Apotheosis'—a realization of greater understanding, essentially a death and rebirth. Only then can they seize the 'Ultimate Boon'—the goal of the quest." },
          { speaker: "Student", text: "And then the movie ends?" },
          { speaker: "Teacher", text: "Not yet. The 'Return' is often the hardest part. The 'Refusal of the Return'—why go back to the boring normal world? But they must. They cross the return threshold, usually chased (The Magic Flight), to bring the boon back to society. They become the 'Master of Two Worlds'—comfortable in both the spiritual and physical realms." }
        ]
      }
    }
  },
  // Chinese Poetry Master (ID: 7)
  '7': {
    curriculum: [
      {
        id: 'cp-ch1',
        title: 'Chapter 1: The High Tang Era (Golden Age)',
        subTopics: [
          { id: 'cp-1-1', title: 'Li Bai: The Banished Immortal' },
          { id: 'cp-1-2', title: 'Du Fu: The Sage of Poetry' },
          { id: 'cp-1-3', title: 'Wang Wei: Poetry in Painting' },
          { id: 'cp-1-4', title: 'Meng Haoran: Voice of the Recluse' },
          { id: 'cp-1-5', title: 'The An Lushan Rebellion Impact' },
          { id: 'cp-1-6', title: 'Frontier Poetry (Border Fortresses)' },
          { id: 'cp-1-7', title: 'High Tang Prosody & Tones' }
        ]
      },
      {
        id: 'cp-ch2',
        title: 'Chapter 2: The Song Dynasty (Lyric Poetry)',
        subTopics: [
          { id: 'cp-2-1', title: 'Su Shi (Dongpo): The Optimist' },
          { id: 'cp-2-2', title: 'Li Qingzhao: Master of Melancholy' },
          { id: 'cp-2-3', title: 'The Shift from Shi to Ci' },
          { id: 'cp-2-4', title: 'Xin Qiji: The Warrior Poet' },
          { id: 'cp-2-5', title: 'Ouyang Xiu: The Literary Statesman' },
          { id: 'cp-2-6', title: 'Willow Yong: Voice of the Commoners' },
          { id: 'cp-2-7', title: 'Song Dynasty Philosophical Depth' }
        ]
      },
      {
        id: 'cp-ch3',
        title: 'Chapter 3: Pre-Tang Foundations',
        subTopics: [
          { id: 'cp-3-1', title: 'The Book of Songs (Shijing)' },
          { id: 'cp-3-2', title: 'Songs of the South (Chu Ci)' },
          { id: 'cp-3-3', title: 'Qu Yuan and the Dragon Boat Festival' },
          { id: 'cp-3-4', title: 'Han Dynasty Music Bureau (Yuefu)' },
          { id: 'cp-3-5', title: 'Cao Cao: The Warlord Poet' },
          { id: 'cp-3-6', title: 'Tao Yuanming: Returning to Farms' },
          { id: 'cp-3-7', title: 'The Seven Sages of the Bamboo Grove' }
        ]
      },
      {
        id: 'cp-ch4',
        title: 'Chapter 4: Poetic Forms & Structures',
        subTopics: [
          { id: 'cp-4-1', title: 'Jueju (Quatrains): The 4-Line Power' },
          { id: 'cp-4-2', title: 'Lushi (Regulated Verse): The 8-Line Craft' },
          { id: 'cp-4-3', title: 'Tonal Patterns (Ping vs Ze)' },
          { id: 'cp-4-4', title: 'Parallelism & Antithesis' },
          { id: 'cp-4-5', title: 'Rhyme Categories' },
          { id: 'cp-4-6', title: 'Allusion & Imagery' },
          { id: 'cp-4-7', title: 'The Structure of a Ci (Tune Patterns)' }
        ]
      },
      {
        id: 'cp-ch5',
        title: 'Chapter 5: Themes of Nature',
        subTopics: [
          { id: 'cp-5-1', title: 'Mountains & Rivers (Shan Shui)' },
          { id: 'cp-5-2', title: 'The Moon: Symbol of Longing' },
          { id: 'cp-5-3', title: 'Flowers: Transience of Life' },
          { id: 'cp-5-4', title: 'Seasons: Autumn Melancholy' },
          { id: 'cp-5-5', title: 'Pine, Bamboo, Plum (Three Friends of Winter)' },
          { id: 'cp-5-6', title: 'Rain and Mist Aesthetics' },
          { id: 'cp-5-7', title: 'Daoist Nature Worship' }
        ]
      },
      {
        id: 'cp-ch6',
        title: 'Chapter 6: Themes of Society & War',
        subTopics: [
          { id: 'cp-6-1', title: 'Anti-War Lamentations' },
          { id: 'cp-6-2', title: 'The Life of the Common Peasant' },
          { id: 'cp-6-3', title: 'Critique of Corruption' },
          { id: 'cp-6-4', title: 'Exile & Banishment' },
          { id: 'cp-6-5', title: 'Friendship & Farewell' },
          { id: 'cp-6-6', title: 'Nostalgia for the Capital' },
          { id: 'cp-6-7', title: 'The Scholar-Official Dilemma' }
        ]
      },
      {
        id: 'cp-ch7',
        title: 'Chapter 7: Late Tang & Five Dynasties',
        subTopics: [
          { id: 'cp-7-1', title: 'Li He: The Ghost Poet' },
          { id: 'cp-7-2', title: 'Li Shangyin: The Cryptic Master' },
          { id: 'cp-7-3', title: 'Du Mu: The Historian' },
          { id: 'cp-7-4', title: 'The Collapse of the Empire' },
          { id: 'cp-7-5', title: 'Li Yu: The Tragic Emperor' },
          { id: 'cp-7-6', title: 'Rise of the Ci Form' },
          { id: 'cp-7-7', title: 'Decadence & Aestheticism' }
        ]
      },
      {
        id: 'cp-ch8',
        title: 'Chapter 8: Women Poets of China',
        subTopics: [
          { id: 'cp-8-1', title: 'Cai Yan (Cai Wenji)' },
          { id: 'cp-8-2', title: 'Xue Tao: The Courtesan Poet' },
          { id: 'cp-8-3', title: 'Yu Xuanji: The Daoist Nun' },
          { id: 'cp-8-4', title: 'Li Qingzhao Deep Dive' },
          { id: 'cp-8-5', title: 'Zhu Shuzhen' },
          { id: 'cp-8-6', title: 'Women in the Red Chamber' },
          { id: 'cp-8-7', title: 'The Female Voice in a Patriarchal Art' }
        ]
      },
      {
        id: 'cp-ch9',
        title: 'Chapter 9: Ming & Qing Dynasties',
        subTopics: [
          { id: 'cp-9-1', title: 'The Revival of Antiquity' },
          { id: 'cp-9-2', title: 'Yuan Mei: The Individualist' },
          { id: 'cp-9-3', title: 'Nalan Xingde: The Manchu Poet' },
          { id: 'cp-9-4', title: 'Poetry in Vernacular Novels' },
          { id: 'cp-9-5', title: 'Gong Zizhen' },
          { id: 'cp-9-6', title: 'Transition to Modern Era' },
          { id: 'cp-9-7', title: 'Influence on Haiku (Japan)' }
        ]
      },
      {
        id: 'cp-ch10',
        title: 'Chapter 10: Modern Reception & Translation',
        subTopics: [
          { id: 'cp-10-1', title: 'Ezra Pound & The Imagists' },
          { id: 'cp-10-2', title: 'Difficulties in Translating Tone' },
          { id: 'cp-10-3', title: 'Gary Snyder & The Beats' },
          { id: 'cp-10-4', title: 'Contemporary Chinese Poetry' },
          { id: 'cp-10-5', title: 'Poetry in Chinese Education Today' },
          { id: 'cp-10-6', title: 'Calligraphy & Poetry Connection' },
          { id: 'cp-10-7', title: 'How to Read Tang Poetry Today' }
        ]
      }
    ],
    lectures: {
      "Li Bai: The Banished Immortal": {
        topic: "Li Bai: The Banished Immortal",
        professorName: "Master Wang",
        studentName: "Student",
        sections: [
          { speaker: "Teacher", text: "Welcome. Today we immerse ourselves in the world of Li Bai (李白), the 'Immortal Poet' (诗仙) of the High Tang Dynasty. His work defines Romanticism in Chinese literature: boundless imagination, a free spirit, and a deep connection with the cosmos." },
          { speaker: "Student", text: "I know his most famous poem, 'Quiet Night Thought' (Jing Ye Si). Every Chinese child learns it." },
          { speaker: "Teacher", text: "Indeed. Let us recite it together. \n\n床前明月光 (Chuáng qián míngyuè guāng)\n疑是地上霜 (Yí shì dìshàng shuāng)\n\n'Bright moonlight before my bed, I suspect it is frost on the ground.' Note the imagery. Why 'frost' (霜)?" },
          { speaker: "Student", text: "It feels cold. Lonely. It's not a warm yellow moon. It suggests a chill in the air." },
          { speaker: "Teacher", text: "Precisely. The moonlight is so bright and cold it deceives the senses. This sets the tone of isolation. Then, the reaction:\n\n举头望明月 (Jǔ tóu wàng míngyuè)\n低头思故乡 (Dī tóu sī gùxiāng)\n\n'I raise my head to gaze at the bright moon, I lower my head and think of my hometown.' The physical movement—Up and Down—mirrors the connection between the Sky (Moon) and the Earth (Home)." },
          { speaker: "Student", text: "It's so simple, just 20 characters, but it captures the universal feeling of homesickness perfectly." },
          { speaker: "Teacher", text: "That is Li Bai's genius. Simplicity holding depth. Now, let us look at his more spirited side: 'Drinking Alone Under the Moon' (月下独酌). \n\n'花间一壶酒，独酌无相亲' (Among the flowers, a pot of wine; I drink alone, no friend is near)." },
          { speaker: "Student", text: "That sounds depressing. Drinking alone among flowers?" },
          { speaker: "Teacher", text: "Ah, but wait! He invents company. \n\n'举杯邀明月，对影成三人' (Raising my cup, I invite the Moon; With my shadow, we become three). He animates the universe! The Moon becomes a drinking buddy. His Shadow becomes a dance partner. He is physically alone, but spiritually connected to the celestial." },
          { speaker: "Student", text: "It's almost Daoist. Being one with nature." },
          { speaker: "Teacher", text: "Exactly. Li Bai was a devout Daoist. He sought freedom from social constraints. Unlike Du Fu, who worried about the state and the war, Li Bai sought transcendence. He called himself the 'Banished Immortal'—a deity kicked out of heaven for misbehavior." },
          { speaker: "Student", text: "Is it true he died trying to catch the moon?" },
          { speaker: "Teacher", text: "Legend says he was drunk on a boat and tried to embrace the reflection of the moon in the Yangtze river, and drowned. It is likely a myth, but it fits his spirit perfectly. He didn't just observe beauty; he wanted to physically merge with it." },
          { speaker: "Student", text: "Did he have a career? Or just wander?" },
          { speaker: "Teacher", text: "He served briefly in the Hanlin Academy for the Emperor, but he was too wild for court life. He supposedly made the Emperor's favorite eunuch take off his boots while he was drunk. He was 'kindly dismissed' and spent the rest of his life wandering, drinking, and writing. He represents the unbridled human spirit." },
          { speaker: "Student", text: "A true rock star of the Tang Dynasty." }
        ]
      }
    }
  },
  // Scripture Voice (ID: 8)
  '8': {
    curriculum: [
      { id: 'sv-ch1', title: 'Chapter 1: Stoicism (Rome)', subTopics: [{ id: 'sv-1-1', title: 'Marcus Aurelius: The Inner Citadel' }, { id: 'sv-1-2', title: 'Epictetus: The Dichotomy of Control' }, { id: 'sv-1-3', title: 'Seneca: On the Shortness of Life' }, { id: 'sv-1-4', title: 'Amor Fati: Loving Fate' }, { id: 'sv-1-5', title: 'Memento Mori: Meditation on Death' }, { id: 'sv-1-6', title: 'Sympatheia: Cosmic Connection' }, { id: 'sv-1-7', title: 'The View from Above' }] },
      { id: 'sv-ch2', title: 'Chapter 2: Taoism (China)', subTopics: [{ id: 'sv-2-1', title: 'Lao Tzu: The Tao Te Ching' }, { id: 'sv-2-2', title: 'Wu Wei: Effortless Action' }, { id: 'sv-2-3', title: 'The Uncarved Block (Pu)' }, { id: 'sv-2-4', title: 'Zhuangzi: The Butterfly Dream' }, { id: 'sv-2-5', title: 'Yin and Yang Dynamics' }, { id: 'sv-2-6', title: 'The Watercourse Way' }, { id: 'sv-2-7', title: 'Governing by Not Governing' }] },
      { id: 'sv-ch3', title: 'Chapter 3: Buddhism (India/Asia)', subTopics: [{ id: 'sv-3-1', title: 'The Four Noble Truths' }, { id: 'sv-3-2', title: 'The Eightfold Path' }, { id: 'sv-3-3', title: 'The Heart Sutra: Form is Emptiness' }, { id: 'sv-3-4', title: 'Zen Koans: The Sound of One Hand' }, { id: 'sv-3-5', title: 'Metta: Loving Kindness' }, { id: 'sv-3-6', title: 'Impermanence (Anicca)' }, { id: 'sv-3-7', title: 'Nirvana and Samsara' }] },
      { id: 'sv-ch4', title: 'Chapter 4: Hinduism (Vedanta)', subTopics: [{ id: 'sv-4-1', title: 'The Bhagavad Gita: Duty (Dharma)' }, { id: 'sv-4-2', title: 'Atman and Brahman' }, { id: 'sv-4-3', title: 'Karma Yoga: Action without Fruit' }, { id: 'sv-4-4', title: 'The Upanishads: Thou Art That' }, { id: 'sv-4-5', title: 'Maya: The Illusion' }, { id: 'sv-4-6', title: 'Moksha: Liberation' }, { id: 'sv-4-7', title: 'Bhakti: The Path of Devotion' }] },
      { id: 'sv-ch5', title: 'Chapter 5: Confucianism', subTopics: [{ id: 'sv-5-1', title: 'The Analects: Ren (Benevolence)' }, { id: 'sv-5-2', title: 'Li: Ritual Propriety' }, { id: 'sv-5-3', title: 'Filial Piety (Xiao)' }, { id: 'sv-5-4', title: 'The Rectification of Names' }, { id: 'sv-5-5', title: 'The Junzi (Gentleman)' }, { id: 'sv-5-6', title: 'Mencius: Human Nature is Good' }, { id: 'sv-5-7', title: 'The Mandate of Heaven' }] },
      { id: 'sv-ch6', title: 'Chapter 6: Sufism (Islamic Mysticism)', subTopics: [{ id: 'sv-6-1', title: 'Rumi: The Guest House' }, { id: 'sv-6-2', title: 'Hafiz: The Gift' }, { id: 'sv-6-3', title: 'The Removal of the Self (Fana)' }, { id: 'sv-6-4', title: 'Love as the Path to God' }, { id: 'sv-6-5', title: 'The Whirling Dervishes' }, { id: 'sv-6-6', title: 'Attar: Conference of the Birds' }, { id: 'sv-6-7', title: 'Remembrance (Dhikr)' }] },
      { id: 'sv-ch7', title: 'Chapter 7: Existentialism', subTopics: [{ id: 'sv-7-1', title: 'Sartre: Radical Freedom' }, { id: 'sv-7-2', title: 'Camus: The Myth of Sisyphus' }, { id: 'sv-7-3', title: 'Nietzsche: Amor Fati' }, { id: 'sv-7-4', title: 'Kierkegaard: Leap of Faith' }, { id: 'sv-7-5', title: 'The Absurd' }, { id: 'sv-7-6', title: 'Existence Precedes Essence' }, { id: 'sv-7-7', title: 'Authenticity vs Bad Faith' }] },
      { id: 'sv-ch8', title: 'Chapter 8: Christian Mysticism', subTopics: [{ id: 'sv-8-1', title: 'St. John of the Cross: Dark Night' }, { id: 'sv-8-2', title: 'Meister Eckhart: Letting Go of God' }, { id: 'sv-8-3', title: 'Teresa of Avila: Interior Castle' }, { id: 'sv-8-4', title: 'The Cloud of Unknowing' }, { id: 'sv-8-5', title: 'Julian of Norwich' }, { id: 'sv-8-6', title: 'Desert Fathers' }, { id: 'sv-8-7', title: 'Centering Prayer' }] },
      { id: 'sv-ch9', title: 'Chapter 9: Indigenous Wisdom', subTopics: [{ id: 'sv-9-1', title: 'The Seven Grandfather Teachings' }, { id: 'sv-9-2', title: 'Connection to Land' }, { id: 'sv-9-3', title: 'Dreamtime (Aboriginal)' }, { id: 'sv-9-4', title: 'The Medicine Wheel' }, { id: 'sv-9-5', title: 'Ubuntu (I am because we are)' }, { id: 'sv-9-6', title: 'Storytelling as Knowledge' }, { id: 'sv-9-7', title: 'Ancestral Veneration' }] },
      { id: 'sv-ch10', title: 'Chapter 10: Modern Applications', subTopics: [{ id: 'sv-10-1', title: 'Mindfulness Based Stress Reduction' }, { id: 'sv-10-2', title: 'Stoicism for Leaders' }, { id: 'sv-10-3', title: 'Digital Minimalism' }, { id: 'sv-10-4', title: 'Effective Altruism' }, { id: 'sv-10-5', title: 'Eco-Philosophy' }, { id: 'sv-10-6', title: 'Secular Buddhism' }, { id: 'sv-10-7', title: 'The Wisdom of Trauma' }] }
    ],
    lectures: {
      "Marcus Aurelius: The Inner Citadel": {
        topic: "Marcus Aurelius: The Inner Citadel",
        professorName: "The Stoic",
        studentName: "Seeker",
        sections: [
          { speaker: "Teacher", text: "Marcus Aurelius was unique in history: a Philosopher King. He was the Emperor of Rome, the most powerful man on earth, yet he wrote 'Meditations'—a private journal to himself—about humility and duty." },
          { speaker: "Student", text: "Why did he need to write it? Was he struggling?" },
          { speaker: "Teacher", text: "He was ruling during wars, plagues, and betrayals. He wrote to keep his mind strong. His core practice was building an 'Inner Citadel'. He wrote: 'You have power over your mind - not outside events. Realize this, and you will find strength.'" },
          { speaker: "Student", text: "That sounds like the Dichotomy of Control." },
          { speaker: "Teacher", text: "Yes. He constantly reminded himself that external things—fame, wealth, the rudeness of others—are 'indifferent'. They are not good or bad. Only his *reaction*, his *judgment* of them, is good or bad." },
          { speaker: "Student", text: "It sounds a bit cold. Did he care about people?" },
          { speaker: "Teacher", text: "Deeply. He believed in 'Sympatheia', the interconnectedness of all things. He wrote: 'What is not good for the beehive, cannot be good for the bee.' He saw his duty as an Emperor not as a privilege, but as a difficult service to the cosmopolis." },
          { speaker: "Student", text: "What about death? He talks about it a lot." },
          { speaker: "Teacher", text: "Memento Mori. Remember you will die. He wrote: 'You could leave life right now. Let that determine what you do and say and think.' It wasn't morbid. It was a call to urgency." },
          { speaker: "Student", text: "Urgency to do what?" },
          { speaker: "Teacher", text: "To be virtuous. To stop wasting time on petty anger or anxiety about the future. 'The present is all we have to live, the rest is either past or uncertain.' Confine yourself to the present. That is where peace is found." },
          { speaker: "Student", text: "How can I apply this today?" },
          { speaker: "Teacher", text: "When someone insults you, pause. Realize the insult is external. It cannot hurt your character unless you let it. Say to yourself: 'They are acting out of ignorance.' Maintain your inner peace. That is the Citadel." },
          { speaker: "Student", text: "It requires a lot of discipline." },
          { speaker: "Teacher", text: "It is a practice, not a destination. Marcus wrote these notes every day because he struggled every day. It gives us hope that even an Emperor had to work at being a good man." }
        ]
      },
      "The Uncarved Block (Pu)": {
        topic: "The Uncarved Block (Pu)",
        professorName: "Taoist Sage",
        studentName: "Disciple",
        sections: [
          { speaker: "Teacher", text: "In the Tao Te Ching, Lao Tzu speaks of 'Pu' (朴), often translated as the 'Uncarved Block'. It is a central metaphor for the Taoist state of being." },
          { speaker: "Student", text: "What does it mean? A piece of wood?" },
          { speaker: "Teacher", text: "It is wood before it has been shaped into a tool or a vessel. Once you carve wood into a cup, it has a function, but it has lost its infinite potential. It is now *only* a cup. The Uncarved Block represents a state of pure potentiality and simplicity." },
          { speaker: "Student", text: "So we should be simple? Like children?" },
          { speaker: "Teacher", text: "Precisely. Society tries to 'carve' us. It tells us to be successful, to be famous, to be useful in specific ways. This carving creates complexity, stress, and artificiality. To return to Pu is to return to your natural state, unburdened by desire or definition." },
          { speaker: "Student", text: "But isn't it good to have a purpose? To be a 'cup'?" },
          { speaker: "Teacher", text: "A cup is brittle. If it breaks, it is useless. The Uncarved Block is robust. By remaining formless, you can adapt to any situation. You move with the Tao rather than resisting it. It is about dropping the 'knowledge' that complicates life and finding the wisdom that simplifies it." },
          { speaker: "Student", text: "How do I practice this?" },
          { speaker: "Teacher", text: "Practice 'Wu Wei' (Effortless Action). Stop trying to force outcomes. Stop labelling things as good or bad. Be content with what is. As Lao Tzu said: 'Manifest plainness, embrace simplicity, reduce selfishness, have few desires.'" },
          { speaker: "Student", text: "It sounds like freedom." },
          { speaker: "Teacher", text: "It is the ultimate freedom. The freedom of not needing to be anything other than what you are." }
        ]
      },
      "The Heart Sutra: Form is Emptiness": {
        topic: "The Heart Sutra: Form is Emptiness",
        professorName: "Bodhisattva",
        studentName: "Monk",
        sections: [
          { speaker: "Teacher", text: "The Heart Sutra is the distillation of Prajnaparamita—Perfect Wisdom. Its most famous line is: 'Form is emptiness, emptiness is form' (Rupa is Sunyata)." },
          { speaker: "Student", text: "This always confuses me. Does it mean nothing exists? Is the world an illusion?" },
          { speaker: "Teacher", text: "Not quite. Emptiness (Sunyata) does not mean 'nothingness'. It means 'empty of independent existence'. Nothing has a fixed, permanent self. Everything exists only in relation to everything else." },
          { speaker: "Student", text: "Can you give an example?" },
          { speaker: "Teacher", text: "Look at a flower. Is it just a flower? No. It is made of non-flower elements: sunlight, rain, soil, time. If you remove the sunlight, the flower disappears. If you remove the soil, it disappears. The flower is 'empty' of a separate self. It is full of the cosmos." },
          { speaker: "Student", text: "So 'Form is Emptiness' means objects are interdependent?" },
          { speaker: "Teacher", text: "Yes. And 'Emptiness is Form' means that this vast interdependence *manifests* as specific objects. They are two sides of the same coin. You cannot have the wave without the water." },
          { speaker: "Student", text: "Why is this realization important? Does it help suffering?" },
          { speaker: "Teacher", text: "It is the cure for suffering. We suffer because we cling to things as if they are permanent. We cling to our 'Self', our ego, our body. When we realize these are empty—flowing processes rather than solid blocks—we can let go. Fear dissolves." },
          { speaker: "Student", text: "Because there is nothing to lose?" },
          { speaker: "Teacher", text: "Exactly. The Sutra says: 'No old age and death, and also no extinction of them.' When you see you are the water, not just the wave, you realize you don't die when the wave crashes. You just return." },
          { speaker: "Student", text: "Gate Gate Pāragate..." },
          { speaker: "Teacher", text: "Yes. 'Gone, gone, gone beyond, gone altogether beyond.' Beyond dualities. Beyond fear. That is enlightenment." }
        ]
      },
      "The Bhagavad Gita: Duty (Dharma)": {
        topic: "The Bhagavad Gita: Duty (Dharma)",
        professorName: "Vedic Scholar",
        studentName: "Arjuna",
        sections: [
          { speaker: "Teacher", text: "The Gita opens on a battlefield. Arjuna, the great warrior, collapses. He refuses to fight because the enemy includes his own cousins and teachers. He is paralyzed by moral doubt." },
          { speaker: "Student", text: "It seems reasonable. Killing family is wrong." },
          { speaker: "Teacher", text: "From a worldly perspective, yes. But Krishna, his charioteer (and the Divine), teaches him a higher truth. He speaks of 'Dharma'—sacred duty. Arjuna is a warrior. His duty is to uphold righteousness (justice). To shrink from that duty because of personal attachment is not compassion; it is cowardice." },
          { speaker: "Student", text: "But the result is death!" },
          { speaker: "Teacher", text: "Krishna reveals the nature of the soul (Atman). 'The soul is neither born, and it does not die.' The body is just a garment. Death is not the end. But the core teaching is 'Karma Yoga'—the Yoga of Action." },
          { speaker: "Student", text: "What is Karma Yoga?" },
          { speaker: "Teacher", text: "Krishna says: 'You have a right to perform your prescribed duties, but you are not entitled to the fruits of your actions.' (Karmanye Vadhikaraste)." },
          { speaker: "Student", text: "Do the work, but don't care about the result?" },
          { speaker: "Teacher", text: "Exactly. Act without attachment. If you fight to win, you will be anxious. If you fight because you hate, you will incur sin. But if you fight simply because it is your duty, dedicating the action to the Divine, you are free." },
          { speaker: "Student", text: "It's about the intention behind the action." },
          { speaker: "Teacher", text: "Yes. Selfless action. When you act without ego, you become an instrument of the divine will. This brings peace even in the midst of war." },
          { speaker: "Student", text: "So I must fight my own battles this way?" },
          { speaker: "Teacher", text: "The Kurukshetra war is a metaphor for the war within your own heart. Between your higher self and your lower impulses. You must fight that battle every day, without wavering." }
        ]
      },
      "Rumi: The Guest House": {
        topic: "Rumi: The Guest House",
        professorName: "Sufi Mystic",
        studentName: "Traveler",
        sections: [
          { speaker: "Teacher", text: "Jalaluddin Rumi, the great Sufi poet, gave us a beautiful metaphor for being human: 'The Guest House'. Do you know it?" },
          { speaker: "Student", text: "I have heard of it. 'This being human is a guest house. Every morning a new arrival.'" },
          { speaker: "Teacher", text: "Yes. 'A joy, a depression, a meanness, some momentary awareness comes as an unexpected visitor.' Rumi teaches us radical hospitality." },
          { speaker: "Student", text: "Even for the bad guests? The depression?" },
          { speaker: "Teacher", text: "Especially them. He says: 'Welcome and entertain them all! Even if they are a crowd of sorrows, who violently sweep your house empty of its furniture.'" },
          { speaker: "Student", text: "Why would I welcome sorrow that destroys me?" },
          { speaker: "Teacher", text: "Because 'He may be clearing you out for some new delight.' The sorrow creates space. It breaks the shell of your ego so that light can enter. In Sufism, the breaking of the heart is often the path to God." },
          { speaker: "Student", text: "It changes how I view pain." },
          { speaker: "Teacher", text: "Pain is not a punishment. It is a messenger. 'The dark thought, the shame, the malice... meet them at the door laughing and invite them in.' Imagine the power of meeting shame with laughter and invitation!" },
          { speaker: "Student", text: "It takes away their power to hurt me." },
          { speaker: "Teacher", text: "It transforms them. By accepting everything that comes, you remain the Host—the witnessing consciousness—rather than becoming the victim of your emotions. Be grateful for whoever comes, 'because each has been sent as a guide from beyond.'" }
        ]
      },
      "St. John of the Cross: Dark Night": {
        topic: "St. John of the Cross: Dark Night",
        professorName: "Theologian",
        studentName: "Seeker",
        sections: [
          { speaker: "Teacher", text: "St. John of the Cross, a 16th-century Spanish mystic, coined the phrase 'The Dark Night of the Soul' (La Noche Oscura). It is often misunderstood as just depression." },
          { speaker: "Student", text: "What is it really?" },
          { speaker: "Teacher", text: "It is a stage of spiritual development. It is a purgation. When you first start seeking God, you might feel 'spiritual sweetness'—comfort, visions, joy. But eventually, God removes these comforts." },
          { speaker: "Student", text: "Why? That seems cruel." },
          { speaker: "Teacher", text: "To wean the soul from attachment to *feelings*. If you only pray when it feels good, you love the feeling, not God. The Dark Night strips away the sensory satisfaction. You feel dry, abandoned, empty." },
          { speaker: "Student", text: "So it's a test?" },
          { speaker: "Teacher", text: "It's a transformation. In the darkness, the senses are put to sleep ('my house being now all stilled'). This allows the soul to communicate with the divine on a deeper, non-sensory level. It is 'dark' only to the senses; to the spirit, it is light." },
          { speaker: "Student", text: "How does one get through it?" },
          { speaker: "Teacher", text: "By doing nothing. By waiting in trust. St. John advises not to fight it or try to force the old feelings back. You must let the ego die in that silence." },
          { speaker: "Student", text: "And what comes after?" },
          { speaker: "Teacher", text: "Union. The poem ends with the lover and the Beloved united. 'All ceased and I abandoned myself... leaving my cares forgotten among the lilies.' The Dark Night leads to the dawn of divine union, a peace that cannot be shaken." }
        ]
      }
    }
  }
};
