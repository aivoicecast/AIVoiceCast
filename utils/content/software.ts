
import { SpotlightChannelData } from '../spotlightContent';

export const SOFTWARE_CONTENT: Record<string, SpotlightChannelData> = {
  // Software Interview Voice (ID: 1)
  '1': {
    curriculum: [
      {
        id: 'si-ch1',
        title: 'Arrays & Strings',
        subTopics: [
          { id: 'si-1-1', title: 'Two Pointer Technique' },
          { id: 'si-1-2', title: 'Sliding Window Pattern' },
          { id: 'si-1-3', title: 'Prefix Sum Arrays' },
          { id: 'si-1-4', title: 'String Manipulation & Regex' },
          { id: 'si-1-5', title: 'Matrix Traversal (2D Arrays)' },
          { id: 'si-1-6', title: 'Kadane\'s Algorithm (Max Subarray)' },
          { id: 'si-1-7', title: 'Sorting Basics (Quick vs Merge)' }
        ]
      },
      {
        id: 'si-ch2',
        title: 'Linked Lists',
        subTopics: [
          { id: 'si-2-1', title: 'Singly vs Doubly Linked Lists' },
          { id: 'si-2-2', title: 'Fast & Slow Pointers (Cycle Detection)' },
          { id: 'si-2-3', title: 'Reversing a Linked List' },
          { id: 'si-2-4', title: 'LRU Cache Implementation' },
          { id: 'si-2-5', title: 'Merge K Sorted Lists' },
          { id: 'si-2-6', title: 'Flatten Multilevel Doubly Linked List' },
          { id: 'si-2-7', title: 'Memory Layout of Lists' }
        ]
      },
      {
        id: 'si-ch3',
        title: 'Trees & Tries',
        subTopics: [
          { id: 'si-3-1', title: 'Binary Tree Traversals (In/Pre/Post)' },
          { id: 'si-3-2', title: 'Binary Search Trees (BST)' },
          { id: 'si-3-3', title: 'Balanced Trees (AVL, Red-Black)' },
          { id: 'si-3-4', title: 'Trie (Prefix Tree) Implementation' },
          { id: 'si-3-5', title: 'Lowest Common Ancestor (LCA)' },
          { id: 'si-3-6', title: 'Serialize and Deserialize Binary Tree' },
          { id: 'si-3-7', title: 'Segment Trees Basics' }
        ]
      },
      {
        id: 'si-ch4',
        title: 'Graphs',
        subTopics: [
          { id: 'si-4-1', title: 'BFS vs DFS' },
          { id: 'si-4-2', title: 'Adjacency Matrix vs List' },
          { id: 'si-4-3', title: 'Topological Sort (Kahn\'s Algorithm)' },
          { id: 'si-4-4', title: 'Dijkstra\'s Algorithm' },
          { id: 'si-4-5', title: 'Bellman-Ford & Negative Cycles' },
          { id: 'si-4-6', title: 'Prim\'s & Kruskal\'s (MST)' },
          { id: 'si-4-7', title: 'Floyd-Warshall Algorithm' }
        ]
      },
      {
        id: 'si-ch5',
        title: 'Dynamic Programming',
        subTopics: [
          { id: 'si-5-1', title: 'Memoization vs Tabulation' },
          { id: 'si-5-2', title: 'Knapsack Problem (0/1 and Unbounded)' },
          { id: 'si-5-3', title: 'Longest Common Subsequence (LCS)' },
          { id: 'si-5-4', title: 'Longest Increasing Subsequence' },
          { id: 'si-5-5', title: 'Matrix Chain Multiplication' },
          { id: 'si-5-6', title: 'DP on Trees' },
          { id: 'si-5-7', title: 'Bitmask DP' }
        ]
      },
      {
        id: 'si-ch6',
        title: 'Backtracking',
        subTopics: [
          { id: 'si-6-1', title: 'Permutations & Combinations' },
          { id: 'si-6-2', title: 'N-Queens Problem' },
          { id: 'si-6-3', title: 'Sudoku Solver' },
          { id: 'si-6-4', title: 'Subset Sum Problem' },
          { id: 'si-6-5', title: 'Word Search in Grid' },
          { id: 'si-6-6', title: 'Hamiltonian Paths' },
          { id: 'si-6-7', title: 'Branch and Bound' }
        ]
      },
      {
        id: 'si-ch7',
        title: 'System Design Basics',
        subTopics: [
          { id: 'si-7-1', title: 'Horizontal vs Vertical Scaling' },
          { id: 'si-7-2', title: 'Load Balancers (L4 vs L7)' },
          { id: 'si-7-3', title: 'Database Sharding & Partitioning' },
          { id: 'si-7-4', title: 'Caching Strategies (Write-Through/Back)' },
          { id: 'si-7-5', title: 'CAP Theorem in Practice' },
          { id: 'si-7-6', title: 'Consistent Hashing' },
          { id: 'si-7-7', title: 'Rate Limiting Algorithms' }
        ]
      },
      {
        id: 'si-ch8',
        title: 'Advanced System Design',
        subTopics: [
          { id: 'si-8-1', title: 'Design a URL Shortener (TinyURL)' },
          { id: 'si-8-2', title: 'Design a Chat App (WhatsApp)' },
          { id: 'si-8-3', title: 'Design a Web Crawler' },
          { id: 'si-8-4', title: 'Design a Rate Limiter' },
          { id: 'si-8-5', title: 'Design Instagram News Feed' },
          { id: 'si-8-6', title: 'Design Uber (Geo-hashing)' },
          { id: 'si-8-7', title: 'Design Youtube (CDN & Transcoding)' }
        ]
      },
      {
        id: 'si-ch9',
        title: 'Operating Systems for Engineers',
        subTopics: [
          { id: 'si-9-1', title: 'Process vs Thread' },
          { id: 'si-9-2', title: 'Concurrency & Race Conditions' },
          { id: 'si-9-3', title: 'Locks, Semaphores, Mutexes' },
          { id: 'si-9-4', title: 'Deadlocks & Prevention' },
          { id: 'si-9-5', title: 'Memory Management (Stack vs Heap)' },
          { id: 'si-9-6', title: 'Virtual Memory & Paging' },
          { id: 'si-9-7', title: 'Context Switching Costs' }
        ]
      },
      {
        id: 'si-ch10',
        title: 'Behavioral & Career',
        subTopics: [
          { id: 'si-10-1', title: 'STAR Method for Stories' },
          { id: 'si-10-2', title: 'Handling Conflict with PMs' },
          { id: 'si-10-3', title: 'Mentoring Junior Engineers' },
          { id: 'si-10-4', title: 'System Failure Post-Mortems' },
          { id: 'si-10-5', title: 'Salary Negotiation' },
          { id: 'si-10-6', title: 'Questions to Ask Interviewers' },
          { id: 'si-10-7', title: 'Red Flags in Company Culture' }
        ]
      }
    ],
    lectures: {
      "Memoization vs Tabulation": {
        topic: "Memoization vs Tabulation",
        professorName: "Interviewer",
        studentName: "Candidate",
        sections: [
          { speaker: "Teacher", text: "Let's dig into Dynamic Programming. It's often the hurdle that trips up candidates. Fundamentally, what is it?" },
          { speaker: "Student", text: "It's an optimization technique. It's basically recursion where we cache the results of overlapping subproblems so we don't re-calculate them." },
          { speaker: "Teacher", text: "Correct. Now, distinguish between Memoization and Tabulation." },
          { speaker: "Student", text: "Memoization is top-down. You start with the main problem, break it down recursively, and store results in a hash map or array. Tabulation is bottom-up. You start with the base cases and fill up a table iteratively." },
          { speaker: "Teacher", text: "Good. Which one is better?" },
          { speaker: "Student", text: "It depends. Memoization is often more intuitive to write if you already have the recursive recurrence. It only solves the subproblems needed. But recursion has overhead." },
          { speaker: "Teacher", text: "And stack overflow risk. Tabulation avoids recursion depth issues. Can you give me an example where Tabulation allows for a massive space optimization?" },
          { speaker: "Student", text: "Fibonacci is the classic one. Or 'Climbing Stairs'. In tabulation, `dp[i]` only depends on `dp[i-1]` and `dp[i-2]`. So we don't need an array of size N. We just need two variables." },
          { speaker: "Teacher", text: "Exactly. Reducing Space Complexity from O(N) to O(1). This is often the follow-up question in interviews. Always look for state reduction in bottom-up DP." },
          { speaker: "Student", text: "Does that apply to the Knapsack problem too?" },
          { speaker: "Teacher", text: "Yes! For 0/1 Knapsack, standard DP uses a 2D array `dp[items][capacity]`. But notice `dp[i][w]` only depends on the previous row `dp[i-1]`. So you can optimize it to a 1D array." },
          { speaker: "Student", text: "But you have to iterate backwards, right? To avoid using the same item twice in the same step." },
          { speaker: "Teacher", text: "Spot on. Iterating backwards ensures you're comparing against the state of the *previous* item iteration, not the current one. That's a senior-level detail." }
        ]
      }
    }
  },
  // Database Internal (ID: 3)
  '3': {
    curriculum: [
      {
        id: 'db-ch1',
        title: 'Storage Engines',
        subTopics: [
          { id: 'db-1-1', title: 'B-Trees vs B+ Trees' },
          { id: 'db-1-2', title: 'LSM Trees (Log Structured Merge)' },
          { id: 'db-1-3', title: 'Page Structure & Slotted Pages' },
          { id: 'db-1-4', title: 'Buffer Pool Management' },
          { id: 'db-1-5', title: 'Columnar vs Row Stores' },
          { id: 'db-1-6', title: 'Bloom Filters in Storage' },
          { id: 'db-1-7', title: 'Compression Techniques (Delta, RLE)' }
        ]
      },
      {
        id: 'db-ch2',
        title: 'Indexing Strategies',
        subTopics: [
          { id: 'db-2-1', title: 'Clustered vs Non-Clustered Indexes' },
          { id: 'db-2-2', title: 'Hash Indexes' },
          { id: 'db-2-3', title: 'Bitmap Indexes' },
          { id: 'db-2-4', title: 'Spatial Indexes (R-Trees, Quad-Trees)' },
          { id: 'db-2-5', title: 'Inverted Indexes (Search)' },
          { id: 'db-2-6', title: 'Covering Indexes' },
          { id: 'db-2-7', title: 'Adaptive Radix Trees' }
        ]
      },
      {
        id: 'db-ch3',
        title: 'Query Execution',
        subTopics: [
          { id: 'db-3-1', title: 'Query Parsing & Planning' },
          { id: 'db-3-2', title: 'Cost-Based Optimization (CBO)' },
          { id: 'db-3-3', title: 'Join Algorithms (Nested Loop, Hash, Merge)' },
          { id: 'db-3-4', title: 'External Merge Sort' },
          { id: 'db-3-5', title: 'Vectorization vs Compilation' },
          { id: 'db-3-6', title: 'Materialized Views' },
          { id: 'db-3-7', title: 'Parallel Query Execution' }
        ]
      },
      {
        id: 'db-ch4',
        title: 'Concurrency Control',
        subTopics: [
          { id: 'db-4-1', title: 'ACID Properties Deep Dive' },
          { id: 'db-4-2', title: 'Isolation Levels (Read Committed to Serializable)' },
          { id: 'db-4-3', title: 'Pessimistic Locking (2PL)' },
          { id: 'db-4-4', title: 'Optimistic Locking (OCC)' },
          { id: 'db-4-5', title: 'MVCC (Multi-Version Concurrency Control)' },
          { id: 'db-4-6', title: 'Deadlock Detection vs Prevention' },
          { id: 'db-4-7', title: 'Phantom Reads & Write Skew' }
        ]
      },
      {
        id: 'db-ch5',
        title: 'Logging & Recovery',
        subTopics: [
          { id: 'db-5-1', title: 'Write-Ahead Logging (WAL)' },
          { id: 'db-5-2', title: 'ARIES Recovery Algorithm' },
          { id: 'db-5-3', title: 'Checkpoints (Fuzzy vs Sharp)' },
          { id: 'db-5-4', title: 'Group Commit' },
          { id: 'db-5-5', title: 'Log Sequence Numbers (LSN)' },
          { id: 'db-5-6', title: 'Undo/Redo Logs' },
          { id: 'db-5-7', title: 'Point-in-Time Recovery' }
        ]
      },
      {
        id: 'db-ch6',
        title: 'Distributed Databases',
        subTopics: [
          { id: 'db-6-1', title: 'CAP Theorem & PACELC' },
          { id: 'db-6-2', title: 'Consistent Hashing' },
          { id: 'db-6-3', title: 'Gossip Protocols' },
          { id: 'db-6-4', title: 'Distributed Transactions (2PC)' },
          { id: 'db-6-5', title: 'Saga Pattern' },
          { id: 'db-6-6', title: 'Leader Election' },
          { id: 'db-6-7', title: 'Clock Synchronization (NTP vs TrueTime)' }
        ]
      },
      {
        id: 'db-ch7',
        title: 'Consensus Algorithms',
        subTopics: [
          { id: 'db-7-1', title: 'Paxos Explained' },
          { id: 'db-7-2', title: 'Raft: Leader, Follower, Candidate' },
          { id: 'db-7-3', title: 'Zab (ZooKeeper Atomic Broadcast)' },
          { id: 'db-7-4', title: 'Byzantine Fault Tolerance' },
          { id: 'db-7-5', title: 'Leases and Epochs' },
          { id: 'db-7-6', title: 'Membership Changes' },
          { id: 'db-7-7', title: 'Split Brain Scenarios' }
        ]
      },
      {
        id: 'db-ch8',
        title: 'Replication',
        subTopics: [
          { id: 'db-8-1', title: 'Synchronous vs Asynchronous' },
          { id: 'db-8-2', title: 'Single Leader vs Multi-Leader' },
          { id: 'db-8-3', title: 'Leaderless (Dynamo-style)' },
          { id: 'db-8-4', title: 'Quorum Reads/Writes (W+R > N)' },
          { id: 'db-8-5', title: 'Conflict Resolution (LWW, Vector Clocks)' },
          { id: 'db-8-6', title: 'Replication Lag' },
          { id: 'db-8-7', title: 'Log Shipping vs Statement Based' }
        ]
      },
      {
        id: 'db-ch9',
        title: 'Sharding',
        subTopics: [
          { id: 'db-9-1', title: 'Range Sharding vs Hash Sharding' },
          { id: 'db-9-2', title: 'Directory-Based Sharding' },
          { id: 'db-9-3', title: 'Hot Spotting Issues' },
          { id: 'db-9-4', title: 'Resharding & Rebalancing' },
          { id: 'db-9-5', title: 'Cross-Shard Joins' },
          { id: 'db-9-6', title: 'Scatter-Gather Queries' },
          { id: 'db-9-7', title: 'Geo-Sharding' }
        ]
      },
      {
        id: 'db-ch10',
        title: 'NewSQL & Future',
        subTopics: [
          { id: 'db-10-1', title: 'Google Spanner & TrueTime' },
          { id: 'db-10-2', title: 'CockroachDB Architecture' },
          { id: 'db-10-3', title: 'Vector Databases (HNSW)' },
          { id: 'db-10-4', title: 'Graph Databases' },
          { id: 'db-10-5', title: 'Time-Series Databases' },
          { id: 'db-10-6', title: 'Disaggregated Storage/Compute' },
          { id: 'db-10-7', title: 'Serverless Databases' }
        ]
      }
    ],
    lectures: {
      "LSM Trees (Log Structured Merge)": {
        topic: "LSM Trees (Log Structured Merge)",
        professorName: "Dr. Storage",
        studentName: "Backend Dev",
        sections: [
          { speaker: "Teacher", text: "If you want high write throughput, B-Trees are often a bottleneck. Why? Because updating a B-Tree usually involves random disk I/O to update pages in place." },
          { speaker: "Student", text: "Random I/O is slow on HDDs, and involves write amplification on SSDs." },
          { speaker: "Teacher", text: "Correct. Enter the Log Structured Merge Tree, or LSM. It powers Cassandra, RocksDB, and BigTable. The core idea is: treat the disk as an append-only log." },
          { speaker: "Student", text: "So writes are sequential?" },
          { speaker: "Teacher", text: "Yes. When a write comes in, it goes into an in-memory structure called a MemTable. Usually a sorted tree. This is fast." },
          { speaker: "Student", text: "What happens when memory fills up?" },
          { speaker: "Teacher", text: "We flush the MemTable to disk as an SSTable (Sorted String Table). This flush is a sequential write. Now the data is persistent." },
          { speaker: "Student", text: "But now I have data split across many SSTable files. How do I read?" },
          { speaker: "Teacher", text: "That's the trade-off. Reads become slower. You have to check the MemTable, then check the most recent SSTable, then the next, and so on. To fix this, we use Compaction." },
          { speaker: "Student", text: "Compaction merges the files in the background?" },
          { speaker: "Teacher", text: "Exactly. It merges old SSTables, discarding deleted keys (tombstones) and keeping only the latest values. We also use Bloom Filters to quickly skip SSTables that definitely don't contain the key." },
          { speaker: "Student", text: "So LSM is: Fast Writes, slower Reads (optimized by bloom filters), and background CPU usage for compaction." },
          { speaker: "Teacher", text: "Perfect summary. That is why write-heavy workloads prefer LSM." }
        ]
      },
      "ARIES Recovery Algorithm": {
        topic: "ARIES Recovery Algorithm",
        professorName: "DB Historian",
        studentName: "Student",
        sections: [
          { speaker: "Teacher", text: "ARIES stands for Algorithms for Recovery and Isolation Exploiting Semantics. It is the gold standard for database crash recovery." },
          { speaker: "Student", text: "Is this about the WAL (Write Ahead Log)?" },
          { speaker: "Teacher", text: "Yes. ARIES defines how we use the WAL to restore consistency after a crash. It has three phases: Analysis, Redo, and Undo." },
          { speaker: "Student", text: "What happens in Analysis?" },
          { speaker: "Teacher", text: "We scan the log forward from the last checkpoint. We determine which transactions were active (winners vs losers) and which pages were dirty at the time of the crash." },
          { speaker: "Student", text: "And Redo?" },
          { speaker: "Teacher", text: "We replay history. We re-apply ALL updates from the log to the pages, even for transactions that will eventually abort. This brings the database to the exact state it was in before the crash." },
          { speaker: "Student", text: "Repeating history... that sounds counter-intuitive. Why not just undo the bad stuff?" },
          { speaker: "Teacher", text: "Because to undo correctly, we need the database to be in a structurally consistent state first. Redo ensures physical consistency. Then, the Undo phase rolls back the 'loser' transactions (those that didn't commit) in reverse order." },
          { speaker: "Teacher", text: "A key innovation of ARIES is the CLR (Compensation Log Record). When we undo an action, we write a CLR to the log so that if we crash *during* recovery, we don't try to undo the undo. We just keep going forward." }
        ]
      },
      "Paxos Explained": {
        topic: "Paxos Explained",
        professorName: "Leslie Lamport",
        studentName: "Distributed Dev",
        sections: [
          { speaker: "Teacher", text: "Paxos is a consensus algorithm. Its goal is simple: get a group of unreliable machines to agree on a single value." },
          { speaker: "Student", text: "Why is that hard? Just vote." },
          { speaker: "Teacher", text: "What if the leader crashes during the vote? What if the network splits? What if messages are delayed? Paxos solves consensus in an asynchronous, non-byzantine system where failures happen." },
          { speaker: "Student", text: "Okay, how does it work? I've heard about Proposers and Acceptors." },
          { speaker: "Teacher", text: "Correct. A Proposer wants the cluster to agree on a value (say, V). It sends a 'Prepare' message with a proposal number N to a quorum of Acceptors." },
          { speaker: "Student", text: "What is the proposal number for?" },
          { speaker: "Teacher", text: "It acts like a logical clock or timestamp. It must be unique and increasing. If an Acceptor receives a Prepare(N), it promises not to accept any future proposals with a number less than N." },
          { speaker: "Student", text: "So it locks the Acceptor into the future?" },
          { speaker: "Teacher", text: "In a sense. The Acceptor also replies with the highest-numbered proposal it has *already* accepted, if any. This is crucial for safety." },
          { speaker: "Student", text: "Why?" },
          { speaker: "Teacher", text: "If a value was already chosen by a previous leader who then crashed, the new Proposer must learn about it and propose THAT value instead of its own. This guarantees we don't overwrite agreed history." },
          { speaker: "Student", text: "Okay, so after the Prepare phase comes the Accept phase?" },
          { speaker: "Teacher", text: "Yes. If the Proposer gets promises from a majority, it sends an 'Accept(N, V)' message. The Acceptors accept it unless they have since promised to a higher N." },
          { speaker: "Student", text: "And if a majority accept it, consensus is reached?" },
          { speaker: "Teacher", text: "Yes. The value is chosen. Learners (other nodes) then find out about it." },
          { speaker: "Student", text: "It sounds simpler than people say." },
          { speaker: "Teacher", text: "The basic algorithm is simple. Implementing it is a nightmare. Leader election, log replication, membership changes, disk corruption... Multi-Paxos handles the stream of values, which is what we actually use in databases like Spanner." }
        ]
      },
      "CAP Theorem & PACELC": {
        topic: "CAP Theorem & PACELC",
        professorName: "Eric Brewer",
        studentName: "System Architect",
        sections: [
          { speaker: "Teacher", text: "The CAP Theorem states that a distributed data store can only provide two of the following three guarantees: Consistency, Availability, and Partition Tolerance." },
          { speaker: "Student", text: "So I can pick CA? Consistency and Availability?" },
          { speaker: "Teacher", text: "No. That is the common misunderstanding. In a distributed system over a network, partitions (P) are inevitable. Network cables get cut. Switches fail. You *must* tolerate partitions." },
          { speaker: "Student", text: "So the choice is really between CP and AP?" },
          { speaker: "Teacher", text: "Exactly. When a partition happens, you have a choice. Do you stop serving requests to ensure data stays consistent (CP)? Or do you serve stale data to stay up (AP)?" },
          { speaker: "Student", text: "Banks would choose CP, right?" },
          { speaker: "Teacher", text: "Yes. You don't want to withdraw money that isn't there. But social media likes might choose AP. It's okay if a 'like' count is delayed." },
          { speaker: "Student", text: "What is PACELC?" },
          { speaker: "Teacher", text: "CAP only talks about partitions. But partitions are rare. What about normal operation? PACELC extends CAP. It says: If there is a Partition (P), choose A or C. Else (E), choose between Latency (L) and Consistency (C)." },
          { speaker: "Student", text: "Latency vs Consistency?" },
          { speaker: "Teacher", text: "Yes. Even without a failure, strong consistency requires coordination (like Paxos), which adds latency. If you want ultra-low latency, you might have to accept eventual consistency." },
          { speaker: "Student", text: "So DynamoDB vs HBase?" },
          { speaker: "Teacher", text: "DynamoDB defaults to eventually consistent reads for speed (PA/EL). HBase is strictly consistent (PC/EC). Understanding this trade-off is key to system design." },
          { speaker: "Student", text: "Are there systems that break this rule?" },
          { speaker: "Teacher", text: "No, it's physics. Speed of light limits coordination. But Google Spanner uses atomic clocks (TrueTime) to make the 'C' window so small it feels like it breaks CAP, but it really just manages the probabilities very well." }
        ]
      },
      "B-Trees vs B+ Trees": {
        topic: "B-Trees vs B+ Trees",
        professorName: "Dr. Bayer",
        studentName: "CS Major",
        sections: [
          { speaker: "Teacher", text: "Let's distinguish between the classic B-Tree and the B+ Tree, which is what virtually all databases actually use." },
          { speaker: "Student", text: "I thought they were the same. Both are balanced search trees." },
          { speaker: "Teacher", text: "They share structure, but differ in data placement. In a standard B-Tree, keys and values (data) are stored in both internal nodes and leaf nodes." },
          { speaker: "Student", text: "And in a B+ Tree?" },
          { speaker: "Teacher", text: "In a B+ Tree, internal nodes store *only* keys for routing. All actual data records reside in the leaf nodes at the bottom." },
          { speaker: "Student", text: "Why does that matter?" },
          { speaker: "Teacher", text: "Fanout. Since internal nodes don't hold bulky data, we can fit many more keys into a single 4KB disk page. Higher fanout means the tree is shorter." },
          { speaker: "Student", text: "Shorter tree means fewer disk seeks?" },
          { speaker: "Teacher", text: "Exactly. A B+ tree with height 3 can verify millions of records. A B-tree might need height 5. That's 2 extra disk I/Os per lookup." },
          { speaker: "Student", text: "What about range queries? SELECT * WHERE id > 100?" },
          { speaker: "Teacher", text: "This is the B+ Tree's killer feature. The leaf nodes are linked together in a linked list. Once you find the start of the range (100), you just scan across the leaves sequentially." },
          { speaker: "Student", text: "And a B-Tree?" },
          { speaker: "Teacher", text: "You'd have to traverse up and down the tree (in-order traversal) to find the next keys. That generates random I/O, which is terrible for performance." },
          { speaker: "Student", text: "So B+ Trees win on range scans and tree height." },
          { speaker: "Teacher", text: "Yes. And cache locality. But B-Trees have one advantage: if the data is near the root, you find it faster. In B+ Trees, you always go to the leaf." },
          { speaker: "Student", text: "But the consistency of B+ Trees seems worth it." },
          { speaker: "Teacher", text: "It is. That's why PostgreSQL, MySQL (InnoDB), and SQLite all use variants of B+ Trees." }
        ]
      },
      "MVCC (Multi-Version Concurrency Control)": {
        topic: "MVCC (Multi-Version Concurrency Control)",
        professorName: "Postgres Expert",
        studentName: "DBA",
        sections: [
          { speaker: "Teacher", text: "In old databases, readers blocked writers, and writers blocked readers. This destroyed concurrency. MVCC fixes this: Readers never block writers." },
          { speaker: "Student", text: "How? If I'm writing to a row, and you read it, what do you see?" },
          { speaker: "Teacher", text: "You see the *old* version. The version that existed before my transaction started. We maintain multiple versions of the same row simultaneously." },
          { speaker: "Student", text: "So we don't overwrite data in place?" },
          { speaker: "Teacher", text: "Conceptually, no. When I update a row, I mark the old row as 'expired' (but keep it) and insert a new version. The database decides which version is visible to you based on your Transaction ID." },
          { speaker: "Student", text: "Snapshot Isolation." },
          { speaker: "Teacher", text: "Exactly. Your query sees a consistent snapshot of the database at the moment it started. Even if I commit 100 changes while you run a long report, your report sees the old stable data." },
          { speaker: "Student", text: "This creates garbage though. Dead rows." },
          { speaker: "Teacher", text: "Yes. In PostgreSQL, we call them 'dead tuples'. They bloat the table. We need a process to clean them up once no active transaction needs them anymore." },
          { speaker: "Student", text: "VACUUM?" },
          { speaker: "Teacher", text: "Yes, the Vacuum process. In MySQL/Oracle, they use 'Undo Segments' to store the old versions separately, so the main table doesn't bloat, but the Undo logs can fill up." },
          { speaker: "Student", text: "Which approach is better?" },
          { speaker: "Teacher", text: "Trade-offs. Postgres allows fast rollbacks but suffers from table bloat (Write Amplification). MySQL keeps tables compact but rollbacks are slower and long queries can fail with 'Snapshot too old'." },
          { speaker: "Student", text: "Does MVCC prevent all race conditions?" },
          { speaker: "Teacher", text: "No. It prevents dirty reads and non-repeatable reads. But it allows 'Write Skew' unless you use Serializable isolation." },
          { speaker: "Student", text: "Write Skew?" },
          { speaker: "Teacher", text: "Imagine two doctors on call. Constraint: at least one must be on call. Both check, see two are on. Both go off duty simultaneously. MVCC allows this because they touched different rows. Serializable checks overlap." }
        ]
      }
    }
  },
  // LLM & Machine Learning (ID: 6)
  '6': {
    curriculum: [
      {
        id: 'ml-ch1',
        title: 'Foundations of Deep Learning',
        subTopics: [
          { id: 'ml-1-1', title: 'Perceptrons & Neural Networks' },
          { id: 'ml-1-2', title: 'Backpropagation & Gradient Descent' },
          { id: 'ml-1-3', title: 'Activation Functions (ReLU, GeLU, Swish)' },
          { id: 'ml-1-4', title: 'Loss Functions (Cross-Entropy)' },
          { id: 'ml-1-5', title: 'Regularization (Dropout, Weight Decay)' },
          { id: 'ml-1-6', title: 'Tokenization (BPE, WordPiece)' },
          { id: 'ml-1-7', title: 'Word Embeddings (Word2Vec, GloVe)' }
        ]
      },
      {
        id: 'ml-ch2',
        title: 'The Transformer Architecture',
        subTopics: [
          { id: 'ml-2-1', title: 'Self-Attention Mechanism' },
          { id: 'ml-2-2', title: 'Multi-Head Attention' },
          { id: 'ml-2-3', title: 'Positional Encodings (RoPE, ALiBi)' },
          { id: 'ml-2-4', title: 'Feed-Forward Networks' },
          { id: 'ml-2-5', title: 'Layer Normalization (Pre-Norm vs Post-Norm)' },
          { id: 'ml-2-6', title: 'Encoder vs Decoder vs Encoder-Decoder' },
          { id: 'ml-2-7', title: 'The Residual Connection' }
        ]
      },
      {
        id: 'ml-ch3',
        title: 'Training LLMs',
        subTopics: [
          { id: 'ml-3-1', title: 'Pre-training Objectives (Masked LM vs Causal LM)' },
          { id: 'ml-3-2', title: 'Scaling Laws (Chinchilla)' },
          { id: 'ml-3-3', title: 'Data Curation & Cleaning' },
          { id: 'ml-3-4', title: 'Distributed Training (Data vs Model Parallelism)' },
          { id: 'ml-3-5', title: 'Mixed Precision Training (BF16)' },
          { id: 'ml-3-6', title: 'Optimizer Choice (AdamW)' },
          { id: 'ml-3-7', title: 'Checkpointing' }
        ]
      },
      {
        id: 'ml-ch4',
        title: 'Fine-Tuning & Alignment',
        subTopics: [
          { id: 'ml-4-1', title: 'Supervised Fine-Tuning (SFT)' },
          { id: 'ml-4-2', title: 'RLHF (Reinforcement Learning from Human Feedback)' },
          { id: 'ml-4-3', title: 'DPO (Direct Preference Optimization)' },
          { id: 'ml-4-4', title: 'PEFT (Parameter Efficient Fine-Tuning)' },
          { id: 'ml-4-5', title: 'LoRA & QLoRA' },
          { id: 'ml-4-6', title: 'Constitutional AI' },
          { id: 'ml-4-7', title: 'Prompt Tuning' }
        ]
      },
      {
        id: 'ml-ch5',
        title: 'Inference Optimization',
        subTopics: [
          { id: 'ml-5-1', title: 'KV Cache Explained' },
          { id: 'ml-5-2', title: 'Decoding Strategies (Greedy, Beam, Top-K, Top-P)' },
          { id: 'ml-5-3', title: 'Speculative Decoding' },
          { id: 'ml-5-4', title: 'Flash Attention' },
          { id: 'ml-5-5', title: 'PagedAttention (vLLM)' },
          { id: 'ml-5-6', title: 'Continuous Batching' },
          { id: 'ml-5-7', title: 'System Prompts' }
        ]
      },
      {
        id: 'ml-ch6',
        title: 'RAG (Retrieval Augmented Generation)',
        subTopics: [
          { id: 'ml-6-1', title: 'Naive RAG Pipeline' },
          { id: 'ml-6-2', title: 'Chunking Strategies' },
          { id: 'ml-6-3', title: 'Vector Databases (HNSW Indexing)' },
          { id: 'ml-6-4', title: 'Hybrid Search (Keyword + Semantic)' },
          { id: 'ml-6-5', title: 'Re-ranking' },
          { id: 'ml-6-6', title: 'Query Expansion' },
          { id: 'ml-6-7', title: 'GraphRAG' }
        ]
      },
      {
        id: 'ml-ch7',
        title: 'Agents & Tool Use',
        subTopics: [
          { id: 'ml-7-1', title: 'ReAct Pattern (Reasoning + Acting)' },
          { id: 'ml-7-2', title: 'Chain of Thought (CoT)' },
          { id: 'ml-7-3', title: 'Tool Calling / Function Calling' },
          { id: 'ml-7-4', title: 'Tree of Thoughts' },
          { id: 'ml-7-5', title: 'Memory (Short-term vs Long-term)' },
          { id: 'ml-7-6', title: 'Multi-Agent Systems' },
          { id: 'ml-7-7', title: 'Planning Algorithms' }
        ]
      },
      {
        id: 'ml-ch8',
        title: 'Evaluation & Benchmarks',
        subTopics: [
          { id: 'ml-8-1', title: 'MMLU, GSM8K, HumanEval' },
          { id: 'ml-8-2', title: 'LLM-as-a-Judge' },
          { id: 'ml-8-3', title: 'Perplexity vs Win Rate' },
          { id: 'ml-8-4', title: 'Data Contamination' },
          { id: 'ml-8-5', title: 'Red Teaming' },
          { id: 'ml-8-6', title: 'Safety Guardrails' },
          { id: 'ml-8-7', title: 'Bias & Fairness' }
        ]
      },
      {
        id: 'ml-ch9',
        title: 'Deployment & Hardware',
        subTopics: [
          { id: 'ml-9-1', title: 'GPU Architecture (H100, A100)' },
          { id: 'ml-9-2', title: 'TPUs vs GPUs' },
          { id: 'ml-9-3', title: 'Memory Bandwidth vs Compute' },
          { id: 'ml-9-4', title: 'Quantization (INT8, FP4, NF4)' },
          { id: 'ml-9-5', title: 'Model Distillation' },
          { id: 'ml-9-6', title: 'Edge AI (Running on Phones)' },
          { id: 'ml-9-7', title: 'Cost Analysis of API vs Self-Host' }
        ]
      },
      {
        id: 'ml-ch10',
        title: 'Future Directions',
        subTopics: [
          { id: 'ml-10-1', title: 'Multimodal Models (Audio/Video)' },
          { id: 'ml-10-2', title: 'System 2 Thinking (Reasoning Models)' },
          { id: 'ml-10-3', title: 'Sparse Mixture of Experts (MoE)' },
          { id: 'ml-10-4', title: 'Long Context Windows' },
          { id: 'ml-10-5', title: 'Embodied AI' },
          { id: 'ml-10-6', title: 'Personalized AI' },
          { id: 'ml-10-7', title: 'AGI Definitions' }
        ]
      }
    ],
    lectures: {
      "Self-Attention Mechanism": {
        topic: "Self-Attention Mechanism",
        professorName: "Dr. Vaswani",
        studentName: "Researcher",
        sections: [
          { speaker: "Teacher", text: "Before Transformers, we used RNNs and LSTMs. They processed text sequentially. This meant they couldn't parallelize well and forgot things from the start of long sentences. Self-Attention changed everything." },
          { speaker: "Student", text: "How does it work essentially?" },
          { speaker: "Teacher", text: "Imagine reading a sentence. When you see the word 'bank', how do you know if it's a river bank or a financial bank? You look at the other words in the sentence. Self-attention creates a weighted connection between 'bank' and every other word." },
          { speaker: "Student", text: "Is that the Query, Key, Value concept?" },
          { speaker: "Teacher", text: "Yes. Think of it like a database retrieval. For every token (the Query), we match it against every other token's Key. The compatibility determines the weight (Attention Score). Then we take a weighted sum of the Values." },
          { speaker: "Student", text: "And we do this for every word simultaneously?" },
          { speaker: "Teacher", text: "Correct. That is the power of the matrix multiplication. It's O(N^2) complexity with respect to sequence length, which is why long context is hard, but it captures infinite range dependencies." },
          { speaker: "Student", text: "So 'Multi-Head' attention means doing this multiple times?" },
          { speaker: "Teacher", text: "Yes. One head might learn grammar dependencies. Another might learn semantic relationships. By having multiple heads, the model learns different representations of the same sequence." }
        ]
      }
    }
  },
  // Google AI Studio (ID: 5)
  '5': {
    curriculum: [
      { id: 'ga-ch1', title: 'Gemini 3.0 Model Family', subTopics: [{ id: 'ga-1-1', title: 'Gemini Ultra, Pro, Flash' }, { id: 'ga-1-2', title: 'Multimodal Native Architecture' }, { id: 'ga-1-3', title: 'Performance vs Latency' }, { id: 'ga-1-4', title: 'Pricing & Tokens' }, { id: 'ga-1-5', title: 'Safety Filters' }] },
      { id: 'ga-ch2', title: 'AI Studio Interface', subTopics: [{ id: 'ga-2-1', title: 'Prompt Playground' }, { id: 'ga-2-2', title: 'System Instructions' }, { id: 'ga-2-3', title: 'Temperature & Top-K' }, { id: 'ga-2-4', title: 'Saving Prompts' }, { id: 'ga-2-5', title: 'Get Code (Export)' }] },
      { id: 'ga-ch3', title: 'Prompt Engineering', subTopics: [{ id: 'ga-3-1', title: 'Zero-shot vs Few-shot' }, { id: 'ga-3-2', title: 'Chain of Thought Prompting' }, { id: 'ga-3-3', title: 'Using Separators' }, { id: 'ga-3-4', title: 'Persona Adoption' }, { id: 'ga-3-5', title: 'Format Instructions (JSON)' }] },
      { id: 'ga-ch4', title: 'The Live API', subTopics: [{ id: 'ga-4-1', title: 'WebSocket Protocol' }, { id: 'ga-4-2', title: 'Audio Streaming Input' }, { id: 'ga-4-3', title: 'Interruption Handling' }, { id: 'ga-4-4', title: 'Tool Use in Live Mode' }, { id: 'ga-4-5', title: 'Voice Selection' }] },
      { id: 'ga-ch5', title: 'Structured Output', subTopics: [{ id: 'ga-5-1', title: 'JSON Schema Definition' }, { id: 'ga-5-2', title: 'Enforcing Constraints' }, { id: 'ga-5-3', title: 'Type Safety' }, { id: 'ga-5-4', title: 'Use Cases: Data Extraction' }] },
      { id: 'ga-ch6', title: 'Function Calling', subTopics: [{ id: 'ga-6-1', title: 'Defining Tools' }, { id: 'ga-6-2', title: 'The Tool Use Loop' }, { id: 'ga-6-3', title: 'Handling API Responses' }, { id: 'ga-6-4', title: 'Parallel Function Calling' }, { id: 'ga-6-5', title: 'Security Considerations' }] },
      { id: 'ga-ch7', title: 'Context Caching', subTopics: [{ id: 'ga-7-1', title: 'How Caching Works' }, { id: 'ga-7-2', title: 'TTL (Time To Live)' }, { id: 'ga-7-3', title: 'Cost Savings' }, { id: 'ga-7-4', title: 'When to use Cache' }] },
      { id: 'ga-ch8', title: 'Fine-Tuning', subTopics: [{ id: 'ga-8-1', title: 'Preparing Datasets' }, { id: 'ga-8-2', title: 'Running a Tuning Job' }, { id: 'ga-8-3', title: 'Evaluating Tuned Models' }, { id: 'ga-8-4', title: 'Limits & Quotas' }] },
      { id: 'ga-ch9', title: 'Building Agents', subTopics: [{ id: 'ga-9-1', title: 'ReAct Pattern with Gemini' }, { id: 'ga-9-2', title: 'Memory Management' }, { id: 'ga-9-3', title: 'Retrieval Tools' }, { id: 'ga-9-4', title: 'Grounding with Google Search' }] },
      { id: 'ga-ch10', title: 'Best Practices', subTopics: [{ id: 'ga-10-1', title: 'Error Handling' }, { id: 'ga-10-2', title: 'Rate Limiting (429)' }, { id: 'ga-10-3', title: 'Production Security' }, { id: 'ga-10-4', title: 'Responsible AI Guidelines' }] }
    ],
    lectures: {
      "WebSocket Protocol": {
        topic: "WebSocket Protocol",
        professorName: "Google DevRel",
        studentName: "App Dev",
        sections: [
          { speaker: "Teacher", text: "The Live API uses WebSockets for bidirectional streaming. This is different from the standard REST API." },
          { speaker: "Student", text: "Why WebSockets?" },
          { speaker: "Teacher", text: "Because conversation is fluid. The user speaks, the model speaks, they might interrupt each other. HTTP is request-response. WebSockets allow full-duplex communication." },
          { speaker: "Student", text: "What data format do we send?" },
          { speaker: "Teacher", text: "We send BSON or JSON messages containing 'realtime_input' with base64 encoded PCM audio chunks. The server replies with 'server_content' containing audio chunks and 'turn_complete' signals." },
          { speaker: "Student", text: "How do we handle auth?" },
          { speaker: "Teacher", text: "You pass the API key in the initial handshake query parameter. Once connected, the session is established until closed or timed out." }
        ]
      }
    }
  }
};
