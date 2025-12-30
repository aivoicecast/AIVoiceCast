
import { SpotlightChannelData } from '../spotlightContent';

export const LINUX_CONTENT: Record<string, SpotlightChannelData> = {
  '2': {
    curriculum: [
      {
        id: 'lk-ch1',
        title: 'Process Scheduling',
        subTopics: [
          { id: 'lk-1-1', title: 'CFS (Completely Fair Scheduler) Internals' },
          { id: 'lk-1-2', title: 'Real-time Classes (FIFO, RR, Deadline)' },
          { id: 'lk-1-3', title: 'Load Balancing & NUMA Awareness' },
          { id: 'lk-1-4', title: 'Context Switch Mechanics (switch_to)' },
          { id: 'lk-1-5', title: 'Scheduler Domains & Groups' },
          { id: 'lk-1-6', title: 'CPU Isolation (isolcpus)' },
          { id: 'lk-1-7', title: 'Cgroups: CPU Shares vs Quotas' },
          { id: 'lk-1-8', title: 'Energy Aware Scheduling (EAS)' },
          { id: 'lk-1-9', title: 'Preemption Models (Voluntary vs Full)' }
        ]
      },
      {
        id: 'lk-ch2',
        title: 'Memory Management',
        subTopics: [
          { id: 'lk-2-1', title: 'Virtual Memory & Page Tables (4/5-level)' },
          { id: 'lk-2-2', title: 'The Buddy Allocator (Physical Pages)' },
          { id: 'lk-2-3', title: 'SLAB vs SLUB vs SLOB Allocators' },
          { id: 'lk-2-4', title: 'Page Cache & Writeback' },
          { id: 'lk-2-5', title: 'Reclaim: LRU Lists (Active/Inactive)' },
          { id: 'lk-2-6', title: 'OOM Killer Mechanics' },
          { id: 'lk-2-7', title: 'Huge Pages & Transparent Huge Pages (THP)' },
          { id: 'lk-2-8', title: 'Memory Compaction & Migration' },
          { id: 'lk-2-9', title: 'KASAN & Memory Debugging' }
        ]
      },
      {
        id: 'lk-ch3',
        title: 'Virtual File System (VFS)',
        subTopics: [
          { id: 'lk-3-1', title: 'The Big Four: Superblock, Inode, Dentry, File' },
          { id: 'lk-3-2', title: 'Pathname Lookup (RCU-walk vs Ref-walk)' },
          { id: 'lk-3-3', title: 'Filesystem Caching (Dcache, Icache)' },
          { id: 'lk-3-4', title: 'Journaling (JBD2 in Ext4)' },
          { id: 'lk-3-5', title: 'Copy-on-Write (Btrfs/XFS)' },
          { id: 'lk-3-6', title: 'Pseudo-filesystems (procfs, sysfs)' },
          { id: 'lk-3-7', title: 'FUSE (Filesystem in Userspace)' },
          { id: 'lk-3-8', title: 'OverlayFS Architecture' }
        ]
      },
      {
        id: 'lk-ch4',
        title: 'Synchronization & Locking',
        subTopics: [
          { id: 'lk-4-1', title: 'Atomic Operations & Memory Barriers' },
          { id: 'lk-4-2', title: 'Spinlocks vs Mutexes vs Semaphores' },
          { id: 'lk-4-3', title: 'RCU (Read-Copy-Update) Deep Dive' },
          { id: 'lk-4-4', title: 'Seqlocks & Reader-Writer Locks' },
          { id: 'lk-4-5', title: 'Per-CPU Variables' },
          { id: 'lk-4-6', title: 'Lockdep: Runtime Locking Correctness' },
          { id: 'lk-4-7', title: 'Priority Inversion & Inheritance' },
          { id: 'lk-4-8', title: 'Ticket Spinlocks vs Queued Spinlocks' }
        ]
      },
      {
        id: 'lk-ch5',
        title: 'Interrupts & System Calls',
        subTopics: [
          { id: 'lk-5-1', title: 'IDT (Interrupt Descriptor Table)' },
          { id: 'lk-5-2', title: 'Top Halves vs Bottom Halves' },
          { id: 'lk-5-3', title: 'Softirqs, Tasklets, and Workqueues' },
          { id: 'lk-5-4', title: 'System Call Entry (SYSCALL vs INT 0x80)' },
          { id: 'lk-5-5', title: 'vDSO & vsyscall' },
          { id: 'lk-5-6', title: 'Context Tracking (NO_HZ_FULL)' },
          { id: 'lk-5-7', title: 'Threaded Interrupts' }
        ]
      },
      {
        id: 'lk-ch6',
        title: 'Device Drivers',
        subTopics: [
          { id: 'lk-6-1', title: 'Character Device Lifecycle (cdev)' },
          { id: 'lk-6-2', title: 'Block Device Layer (bio, request_queue)' },
          { id: 'lk-6-3', title: 'Platform Drivers & Device Tree' },
          { id: 'lk-6-4', title: 'PCIe Subsystem & Enumeration' },
          { id: 'lk-6-5', title: 'DMA Engine API & IOMMU' },
          { id: 'lk-6-6', title: 'Input Subsystem (evdev)' },
          { id: 'lk-6-7', title: 'Firmware Loading' },
          { id: 'lk-6-8', title: 'Driver Binding & Probing' }
        ]
      },
      {
        id: 'lk-ch7',
        title: 'Networking Stack',
        subTopics: [
          { id: 'lk-7-1', title: 'The sk_buff Structure Anatomy' },
          { id: 'lk-7-2', title: 'NAPI (New API) & RX Polling' },
          { id: 'lk-7-3', title: 'Qdiscs (Queueing Disciplines)' },
          { id: 'lk-7-4', title: 'Netfilter & iptables Architecture' },
          { id: 'lk-7-5', title: 'TCP State Machine in Kernel' },
          { id: 'lk-7-6', title: 'XDP (eXpress Data Path)' },
          { id: 'lk-7-7', title: 'Neighbor Discovery (ARP/ND)' },
          { id: 'lk-7-8', title: 'Socket Layer & VFS Interaction' }
        ]
      },
      {
        id: 'lk-ch8',
        title: 'IPC (Inter-Process Communication)',
        subTopics: [
          { id: 'lk-8-1', title: 'Pipes & FIFOs' },
          { id: 'lk-8-2', title: 'Unix Domain Sockets' },
          { id: 'lk-8-3', title: 'Shared Memory (shmget vs mmap)' },
          { id: 'lk-8-4', title: 'Message Queues' },
          { id: 'lk-8-5', title: 'Signals & Signal Handling' },
          { id: 'lk-8-6', title: 'Futexes (Fast Userspace Mutexes)' },
          { id: 'lk-8-7', title: 'Namespaces (IPC NS)' }
        ]
      },
      {
        id: 'lk-ch9',
        title: 'Virtualization & Containers',
        subTopics: [
          { id: 'lk-9-1', title: 'Namespaces (PID, MNT, NET, UTS)' },
          { id: 'lk-9-2', title: 'Cgroups v1 vs v2' },
          { id: 'lk-9-3', title: 'KVM (Kernel-based Virtual Machine)' },
          { id: 'lk-9-4', title: 'Virtio Drivers' },
          { id: 'lk-9-5', title: 'Hardware Virtualization (VT-x/AMD-V)' },
          { id: 'lk-9-6', title: 'Seccomp & Capabilities' },
          { id: 'lk-9-7', title: 'Container Runtimes Interface' }
        ]
      },
      {
        id: 'lk-ch10',
        title: 'Tracing & Debugging',
        subTopics: [
          { id: 'lk-10-1', title: 'eBPF Architecture & Verifier' },
          { id: 'lk-10-2', title: 'Ftrace & Tracepoints' },
          { id: 'lk-10-3', title: 'Kprobes & Uprobes' },
          { id: 'lk-10-4', title: 'Perf Events' },
          { id: 'lk-10-5', title: 'Crash Dump Analysis (Kdump)' },
          { id: 'lk-10-6', title: 'Dynamic Debugging' },
          { id: 'lk-10-7', title: 'SystemTap vs BCC vs bpftrace' }
        ]
      },
      {
        id: 'lk-ch11',
        title: 'Real-Time & Partitioning',
        subTopics: [
          { id: 'lk-11-1', title: 'Jailhouse Hypervisor' },
          { id: 'lk-11-2', title: 'PREEMPT_RT Patchset' },
          { id: 'lk-11-3', title: 'Xenomai vs Jailhouse' },
          { id: 'lk-11-4', title: 'Mixed Criticality Systems' }
        ]
      }
    ],
    lectures: {
      "Jailhouse Hypervisor": {
        topic: "Jailhouse Hypervisor",
        professorName: "Jan K. (Virtual)",
        studentName: "Embedded Dev",
        sections: [
          { speaker: "Teacher", text: "Today we discuss Jailhouse. It is fundamentally different from KVM or Xen. It is a 'partitioning hypervisor'." },
          { speaker: "Student", text: "Does that mean it doesn't virtualize hardware?" },
          { speaker: "Teacher", text: "Correct. It doesn't emulate a fake network card or disk. Instead, it takes the hardware resources (CPUs, RAM, PCI devices) and statically splits them into isolated 'Cells'. Each cell owns its hardware directly." },
          { speaker: "Student", text: "When did this land in the kernel?" },
          { speaker: "Teacher", text: "It was announced in 2013. The kernel support for running Linux *as a guest* (non-root cell) landed in version 4.16 with the `JAILHOUSE_GUEST` config flag. However, the hypervisor tool itself remains an external module." },
          { speaker: "Student", text: "Do I need PREEMPT_RT to use it?" },
          { speaker: "Teacher", text: "No. Jailhouse provides 'Spatial Isolation' (Hardware Partitioning). PREEMPT_RT provides 'Temporal Determinism' (Real-time scheduling). They are orthogonal but complementary." },
          { speaker: "Student", text: "So I can use both?" },
          { speaker: "Teacher", text: "Yes, and you should for mixed-criticality systems. You could have Cell 0 running standard Linux for UI, and Cell 1 running a bare-metal safety loop or a PREEMPT_RT Linux kernel for robot control. Jailhouse ensures the UI never steals CPU cycles from the Robot." },
          { speaker: "Student", text: "Why not just use `isolcpus`?" },
          { speaker: "Teacher", text: "`isolcpus` is soft isolation. The kernel can still interrupt that CPU for workqueues or TLB flush IPIs. Jailhouse uses hardware virtualization (VT-x) to strictly forbid the root Linux from touching the resources assigned to the real-time cell. It's a much stronger guarantee." }
        ]
      },
      "CFS (Completely Fair Scheduler) Internals": {
        topic: "CFS (Completely Fair Scheduler) Internals",
        professorName: "Linus T.",
        studentName: "Kernel Padawan",
        sections: [
          { speaker: "Teacher", text: "Today we dissect the heart of Linux: the Completely Fair Scheduler (CFS). The goal is simple: model an 'ideal, precise multi-tasking CPU'." },
          { speaker: "Student", text: "What is an ideal CPU?" },
          { speaker: "Teacher", text: "Imagine a CPU that can run multiple tasks in parallel at the exact same speed. If you have 2 tasks, each gets 50% power instantly. If 4 tasks, 25%. No switching cost." },
          { speaker: "Student", text: "But real hardware can't do that. We have to context switch." },
          { speaker: "Teacher", text: "Correct. So CFS approximates this using a concept called 'Virtual Runtime' or vruntime. We track exactly how long a task has run on the physical CPU." },
          { speaker: "Student", text: "So if a task runs for 10ms, its vruntime increases by 10ms?" },
          { speaker: "Teacher", text: "If it has default priority (nice 0), yes. If it has a higher priority (negative nice), its vruntime increases slower. This allows it to run longer for the same 'cost'. The scheduler always picks the task with the *lowest* vruntime." },
          { speaker: "Student", text: "Because that task is the most 'starved' compared to the ideal CPU?" },
          { speaker: "Teacher", text: "Exactly. Now, data structures. How do we find the minimum vruntime efficiently? We used to use a linked list in O(N). That was the O(1) scheduler era, confusingly." },
          { speaker: "Student", text: "O(N) is too slow for thousands of threads." },
          { speaker: "Teacher", text: "Right. CFS uses a Red-Black Tree. It's a self-balancing binary search tree. The task with the lowest vruntime is always the leftmost node." },
          { speaker: "Student", text: "So picking the next task is O(1)?" },
          { speaker: "Teacher", text: "Yes, just follow the left pointer. Inserting a task back into the tree after it runs is O(log N). For N=1000 tasks, log N is roughly 10. It's incredibly fast." },
          { speaker: "Student", text: "What happens when a new task wakes up? Like a sleeping web server thread?" },
          { speaker: "Teacher", text: "It needs a vruntime. If we start it at 0, it would be way lower than everyone else and hog the CPU forever. So we set its vruntime to the current minimum vruntime of the tree (min_vruntime)." },
          { speaker: "Student", text: "That makes sense. It enters the race alongside the current leaders." },
          { speaker: "Teacher", text: "There is a slight penalty added to ensure it doesn't preempt immediately if we want to batch workloads, but yes. That is the essence of fairness." },
          { speaker: "Student", text: "Does CFS handle I/O bound tasks well?" },
          { speaker: "Teacher", text: "Yes. I/O tasks sleep often. While sleeping, their vruntime doesn't increase. When they wake up, they are far behind, so they get immediate CPU time. This makes the system feel responsive." }
        ]
      },
      "RCU (Read-Copy-Update) Deep Dive": {
        topic: "RCU (Read-Copy-Update) Deep Dive",
        professorName: "Paul McKenney",
        studentName: "Systems Eng",
        sections: [
          { speaker: "Teacher", text: "Locking is the enemy of scalability. RW-Locks effectively serialize readers because of cache-line bouncing on the lock counter. RCU solves this." },
          { speaker: "Student", text: "How can you read without locking? What if someone deletes the data?" },
          { speaker: "Teacher", text: "In RCU, readers access data without *any* locks or atomic operations. They just verify they are in an RCU read-side critical section. It's zero cost." },
          { speaker: "Student", text: "That sounds unsafe. If a writer frees memory while I'm reading it..." },
          { speaker: "Teacher", text: "Writers don't update in place. That's the 'Copy-Update' part. The writer creates a copy of the data structure, modifies the copy, and then updates the global pointer to point to the new copy." },
          { speaker: "Student", text: "Okay, so new readers see the new data. But I'm still reading the old copy!" },
          { speaker: "Teacher", text: "Exactly. And this is the magic: the writer cannot free the old copy yet. It must wait for a 'Grace Period'." },
          { speaker: "Student", text: "What defines a Grace Period?" },
          { speaker: "Teacher", text: "A Grace Period ends when all CPUs have gone through a context switch (or a quiescent state). Since RCU readers cannot sleep, a context switch guarantees that no reader is holding a reference to the old data." },
          { speaker: "Student", text: "So the writer blocks until everyone is done?" },
          { speaker: "Teacher", text: "The writer *can* block (`synchronize_rcu`), or it can just register a callback (`call_rcu`) to free the memory later. This allows the writer to proceed immediately." },
          { speaker: "Student", text: "Where is this used most?" },
          { speaker: "Teacher", text: "Network routing tables, directory entry caches (dentry), module lists. Anywhere you have 99% reads and 1% writes. RCU is why Linux scales to 4096 cores." },
          { speaker: "Student", text: "Is there a downside?" },
          { speaker: "Teacher", text: "Complexity. And memory usage. Old copies hang around until the grace period ends. If you have a write storm, you can run out of memory (OOM) because RCU callbacks pile up." },
          { speaker: "Student", text: "How do we debug RCU stalls?" },
          { speaker: "Teacher", text: "The kernel detects if a CPU stays in a critical section too long and prints an 'RCU CPU Stall' warning. It usually means a reader loop forgot to yield or disable preemption." },
          { speaker: "Student", text: "Fascinating. It trades memory for massive read concurrency." },
          { speaker: "Teacher", text: "Precisely. It is one of the most sophisticated algorithms in the kernel." }
        ]
      },
      "The sk_buff Structure Anatomy": {
        topic: "The sk_buff Structure Anatomy",
        professorName: "David M.",
        studentName: "NetDev",
        sections: [
          { speaker: "Teacher", text: "The `sk_buff` (socket buffer) is arguably the most important data structure in the kernel networking subsystem." },
          { speaker: "Student", text: "It holds the packet data, right?" },
          { speaker: "Teacher", text: "Yes, but it's much more. It manages the metadata for the packet's journey from the NIC to the application. It has to handle Ethernet headers, IP headers, TCP headers, and payload, without copying data." },
          { speaker: "Student", text: "How do you avoid copying when stripping headers?" },
          { speaker: "Teacher", text: "We use pointers: `head`, `data`, `tail`, and `end`. `head` and `end` point to the allocated memory block. `data` and `tail` point to the actual packet content." },
          { speaker: "Student", text: "So when a packet moves from driver to IP layer..." },
          { speaker: "Teacher", text: "We just increment the `data` pointer by `sizeof(ethhdr)`. The data stays in place. We effectively 'pop' the header by moving a pointer. O(1) operation." },
          { speaker: "Student", text: "What about adding headers for sending?" },
          { speaker: "Teacher", text: "We reserve 'headroom' when allocating the skb. We decrement the `data` pointer to write the header into that empty space. If we run out of headroom, we're in trouble and might have to reallocate." },
          { speaker: "Student", text: "What is `skb_shared_info`?" },
          { speaker: "Teacher", text: "That sits at the end of the data block. It holds fragments. If a packet is too large for one buffer (like with Jumbo Frames or TSO), the data continues in a list of memory pages pointed to by `frags`." },
          { speaker: "Student", text: "This is Scatter-Gather I/O?" },
          { speaker: "Teacher", text: "Yes. The NIC can read these separate memory pages via DMA and combine them on the wire. The CPU never has to stitch them into a contiguous buffer." },
          { speaker: "Student", text: "Does sk_buff enforce locking?" },
          { speaker: "Teacher", text: "No. The skb is owned by one CPU at a time usually. But `skb->users` is an atomic reference count. When you clone a packet (for tcpdump), you just increment the count. You don't copy the data until someone tries to write to it." },
          { speaker: "Student", text: "Copy-on-Write again." },
          { speaker: "Teacher", text: "It's the Unix way." },
          { speaker: "Student", text: "Why is the struct so big?" },
          { speaker: "Teacher", text: "It's bloated. It has accumulated fields for VLANs, timestamps, checksums, firewall marks, priority queues... optimizing `sizeof(struct sk_buff)` is a constant battle for cache locality." }
        ]
      }
    }
  }
};
