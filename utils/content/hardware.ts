
import { SpotlightChannelData } from '../spotlightContent';

export const HARDWARE_CONTENT: Record<string, SpotlightChannelData> = {
  // Oracle Acceleron
  'oracle-acceleron': {
    curriculum: [
      {
        id: 'oa-ch1',
        title: 'Acceleron Architecture',
        subTopics: [
          { id: 'oa-1-1', title: 'Dedicated Fabric vs Shared Network' },
          { id: 'oa-1-2', title: 'Multiplanar Scale-Out' },
          { id: 'oa-1-3', title: 'RoCEv2 Implementation' }
        ]
      },
      {
        id: 'oa-ch2',
        title: 'DPU & SmartNIC',
        subTopics: [
          { id: 'oa-2-1', title: 'Host Offload Mechanics' },
          { id: 'oa-2-2', title: 'Zero Trust Packet Routing (ZPR)' },
          { id: 'oa-2-3', title: 'Storage Acceleration' }
        ]
      }
    ],
    lectures: {
      "Dedicated Fabric vs Shared Network": {
        topic: "Dedicated Fabric vs Shared Network",
        professorName: "Cloud Architect",
        studentName: "SysAdmin",
        sections: [
          { speaker: "Teacher", text: "Traditional clouds share the network between your DB, your neighbors' Netflix streaming, and storage backups. This causes 'jitter'." },
          { speaker: "Student", text: "Why is jitter bad for AI?" },
          { speaker: "Teacher", text: "AI Training uses 'All-Reduce' operations. If one GPU is late receiving a packet, all 1,000 GPUs wait. Acceleron uses a dedicated fabric to eliminate this noise." }
        ]
      }
    }
  },
  // Broadcom SmartNIC
  'broadcom-smartnic': {
    curriculum: [
      {
        id: 'bc-ch1',
        title: 'SmartNIC Fundamentals',
        subTopics: [
          { id: 'bc-1-1', title: 'The Stingray Architecture (ARM + NetXtreme)' },
          { id: 'bc-1-2', title: 'Hardware Offload Engines' }
        ]
      },
      {
        id: 'bc-ch2',
        title: '800G AI Networking',
        subTopics: [
          { id: 'bc-2-1', title: 'Thor Ultra 800G NIC' },
          { id: 'bc-2-2', title: 'Congestion Control for AI Clusters' }
        ]
      }
    ],
    lectures: {
      "Thor Ultra 800G NIC": {
        topic: "Thor Ultra 800G NIC",
        professorName: "Chip Designer",
        studentName: "Engineer",
        sections: [
          { speaker: "Teacher", text: "Thor Ultra is designed for the bandwidth-hungry nature of LLMs. 800 Gigabits per second per port." },
          { speaker: "Student", text: "Is it just about speed?" },
          { speaker: "Teacher", text: "No. It's about telemetry. The NIC reports congestion back to the switch in nanoseconds to pause traffic before buffers overflow." }
        ]
      }
    }
  },
  // SmartNIC Interview
  'smartnic-interview': {
    curriculum: [
      {
        id: 'sni-ch1',
        title: 'Driver Basics',
        subTopics: [
          { id: 'sni-1-1', title: 'Ring Buffers (RX/TX)' },
          { id: 'sni-1-2', title: 'Interrupt Coalescing' },
          { id: 'sni-1-3', title: 'NAPI Polling Mode' }
        ]
      },
      {
        id: 'sni-ch2',
        title: 'Flow Control',
        subTopics: [
          { id: 'sni-2-1', title: 'netif_stop_queue & netif_wake_queue' },
          { id: 'sni-2-2', title: 'BQL (Byte Queue Limits)' }
        ]
      },
      {
        id: 'sni-ch3',
        title: 'RDMA / RoCE',
        subTopics: [
          { id: 'sni-3-1', title: 'WQE (Work Queue Element)' },
          { id: 'sni-3-2', title: 'CQE (Completion Queue Element)' },
          { id: 'sni-3-3', title: 'Memory Registration & pinning' }
        ]
      }
    ],
    lectures: {
      "netif_stop_queue & netif_wake_queue": {
        topic: "netif_stop_queue & netif_wake_queue",
        professorName: "Interviewer",
        studentName: "Candidate",
        sections: [
          { speaker: "Teacher", text: "Scenario: Your hardware TX ring is full. You cannot accept more packets from the OS. What do you do?" },
          { speaker: "Student", text: "I return NETDEV_TX_BUSY?" },
          { speaker: "Teacher", text: "No! That causes packet drops. You must call `netif_stop_queue()`. This tells the kernel stack to stop sending you data. When the hardware interrupts you to say 'TX Complete', you clean the ring and call `netif_wake_queue()`." }
        ]
      }
    }
  }
};
