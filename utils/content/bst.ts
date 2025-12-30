
import { SpotlightChannelData } from '../spotlightContent';

export const BST_CONTENT: Record<string, SpotlightChannelData> = {
  'bst-masterclass': {
    curriculum: [
      {
        id: 'bst-ch1',
        title: 'Validation Algorithms',
        subTopics: [
          { id: 'bst-1-1', title: '6 Ways to Validate a BST' },
          { id: 'bst-1-2', title: 'Map vs Non-Map Iterative Post-Order' }
        ]
      }
    ],
    lectures: {
      "6 Ways to Validate a BST": {
        topic: "6 Ways to Validate a BST",
        professorName: "Prof. Binary",
        studentName: "Coder",
        sections: [
          {
            speaker: "Teacher",
            text: "Welcome. Today we break down the 6 canonical ways to validate a Binary Search Tree. We will look at Pre-order, In-order, and Post-order traversals, both recursively and iteratively."
          },
          {
            speaker: "Teacher",
            text: "### 1. Recursive Pre-Order (Top-Down)\nThis is the standard approach where we pass valid range constraints `(min, max)` down to children.\n\n**Python**\n```python\ndef isBST(root, min_v=float('-inf'), max_v=float('inf')):\n    if not root: return True\n    if not (min_v < root.val < max_v): return False\n    return isBST(root.left, min_v, root.val) and \\\n           isBST(root.right, root.val, max_v)\n```"
          },
          {
            speaker: "Teacher",
            text: "### 2. Iterative Pre-Order\nWe simulate recursion using a stack that stores `(node, min, max)` tuples.\n\n**C++20**\n```cpp\nbool isBST(TreeNode* root) {\n    stack<tuple<TreeNode*, long long, long long>> s;\n    s.push({root, LONG_MIN, LONG_MAX});\n    while (!s.empty()) {\n        auto [node, min, max] = s.top(); s.pop();\n        if (!node) continue;\n        if (node->val <= min || node->val >= max) return false;\n        s.push({node->right, node->val, max});\n        s.push({node->left, min, node->val});\n    }\n    return true;\n}\n```"
          },
          {
            speaker: "Teacher",
            text: "### 3. Recursive In-Order\nIn-Order traversal (Left-Root-Right) yields sorted values. We just check if `current > previous`.\n\n**Python**\n```python\nself.prev = float('-inf')\ndef isBST(root):\n    if not root: return True\n    if not isBST(root.left): return False\n    if root.val <= self.prev: return False\n    self.prev = root.val\n    return isBST(root.right)\n```"
          },
          {
            speaker: "Teacher",
            text: "### 4. Iterative In-Order\nStandard iterative traversal using a stack to go as left as possible.\n\n**C++20**\n```cpp\nbool isBST(TreeNode* root) {\n    stack<TreeNode*> s;\n    TreeNode* curr = root;\n    long long prev = LONG_MIN;\n    while (curr || !s.empty()) {\n        while (curr) { s.push(curr); curr = curr->left; }\n        curr = s.top(); s.pop();\n        if (curr->val <= prev) return false;\n        prev = curr->val;\n        curr = curr->right;\n    }\n    return true;\n}\n```"
          },
          {
            speaker: "Teacher",
            text: "### 5. Recursive Post-Order (Bottom-Up)\nSubtrees report their range `(min, max)` up to the parent. The parent validates itself against these ranges.\n\n**Python**\n```python\ndef validate(node):\n    if not node: return (True, float('inf'), float('-inf'))\n    l, l_min, l_max = validate(node.left)\n    r, r_min, r_max = validate(node.right)\n    if not l or not r: return (False, 0, 0)\n    if (node.left and l_max >= node.val) or \\\n       (node.right and r_min <= node.val):\n        return (False, 0, 0)\n    return (True, min(node.val, l_min), max(node.val, r_max))\n```"
          },
          {
             speaker: "Teacher",
             text: "### 6. Iterative Post-Order\nThis is complex. We use a Hash Map to store children results because we visit children before parents in Post-Order.\n\n**Logic:**\n1. Use stack for traversal order.\n2. Mark nodes as visited on first pass.\n3. On second pass (after children), retrieve children ranges from Map, validate, and store current node's range in Map."
          }
        ]
      },
      "Map vs Non-Map Iterative Post-Order": {
        topic: "Map vs Non-Map Iterative Post-Order",
        professorName: "Prof. Optimize",
        studentName: "Student",
        sections: [
          {
            speaker: "Teacher",
            text: "Iterative Post-Order is the hardest validation to implement. The naive solution uses a **Hash Map** to store child results. But is that optimal?"
          },
          {
            speaker: "Student",
            text: "Maps have O(1) access time, so time complexity is fine. But what about space?"
          },
          {
            speaker: "Teacher",
            text: "Exactly. A Map stores an entry for *every* node in the tree. This makes the Space Complexity **O(N)**. A better way is to use a secondary **Stack (Range Stack)** to bubble up values. This reduces Space Complexity to **O(H)** (height of tree)."
          },
          {
            speaker: "Teacher",
            text: "Here is the optimized **Non-Map (Stack)** solution in Python. Notice how we pop results from the `range_stack`:\n\n```python\ndef isBST_NoMap(root):\n    stack, range_stack = [], []\n    last_node, curr = None, root\n    while stack or curr:\n        if curr:\n            stack.append(curr)\n            curr = curr.left\n        else:\n            peek = stack[-1]\n            if peek.right and last_node != peek.right:\n                curr = peek.right\n            else:\n                node = stack.pop()\n                r_min, r_max = float('inf'), float('-inf')\n                l_min, l_max = float('inf'), float('-inf')\n                \n                # IMPORTANT: Pop Right Child result first (LIFO)\n                if node.right:\n                    r_min, r_max = range_stack.pop()\n                    if node.val >= r_min: return False\n                    \n                # Then Pop Left Child result\n                if node.left:\n                    l_min, l_max = range_stack.pop()\n                    if l_max >= node.val: return False\n                    \n                # Push merged result for parent\n                cur_min = l_min if node.left else node.val\n                cur_max = r_max if node.right else node.val\n                range_stack.append((cur_min, cur_max))\n                \n                last_node = node\n    return True\n```"
          },
          {
            speaker: "Student",
            text: "So the key is popping from the `range_stack` in the reverse order of visits?"
          },
          {
            speaker: "Teacher",
            text: "Yes. Post-order guarantees we visit Left, then Right, then Node. So when we process the Node, the top of the stack is Right's result, and below that is Left's result."
          }
        ]
      }
    }
  }
};
