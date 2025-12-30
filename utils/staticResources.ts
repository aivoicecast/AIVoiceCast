
export interface CodeBlock {
  language: 'python' | 'cpp';
  code: string;
  explanation: string;
  title: string;
}

export interface ReadingMaterial {
  title: string;
  blocks: CodeBlock[];
}

export const STATIC_READING_MATERIALS: Record<string, ReadingMaterial[]> = {
  "Root to Leaf: The BST Masterclass": [
    {
      title: "Python Implementations",
      blocks: [
        {
          title: "1. Recursive Pre-Order (Range Constraint)",
          language: "python",
          code: `class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

def isBST_PreOrder_Recursive(root, min_val=float('-inf'), max_val=float('inf')):
    if not root:
        return True
    
    if not (min_val < root.val < max_val):
        return False
        
    return (isBST_PreOrder_Recursive(root.left, min_val, root.val) and
            isBST_PreOrder_Recursive(root.right, root.val, max_val))`,
          explanation: "This is the standard 'Top-Down' verification. When moving left, the current node value becomes the new maximum limit. When moving right, the current node value becomes the new minimum limit."
        },
        {
          title: "2. Iterative Pre-Order (Stack with Constraints)",
          language: "python",
          code: `def isBST_PreOrder_Iterative(root):
    if not root:
        return True
    
    # Stack stores tuple: (node, min_limit, max_limit)
    stack = [(root, float('-inf'), float('inf'))]
    
    while stack:
        node, lower, upper = stack.pop()
        
        if not node:
            continue
            
        if not (lower < node.val < upper):
            return False
            
        # Push Right child (update lower bound)
        stack.append((node.right, node.val, upper))
        # Push Left child (update upper bound)
        stack.append((node.left, lower, node.val))
        
    return True`,
          explanation: "This mimics the recursive stack. We push the right child first so the left child is processed first (LIFO), adhering to Pre-Order traversal logic."
        },
        {
          title: "3. Recursive In-Order (Sorted Check)",
          language: "python",
          code: `class Validator:
    def __init__(self):
        self.prev = float('-inf')

    def validate(self, node):
        if not node:
            return True
        
        # Traverse Left
        if not self.validate(node.left):
            return False
            
        # Process Root (Check against previous)
        if node.val <= self.prev:
            return False
        self.prev = node.val
        
        # Traverse Right
        return self.validate(node.right)

def isBST_InOrder_Recursive(root):
    return Validator().validate(root)`,
          explanation: "In a valid BST, an In-Order traversal (Left, Root, Right) must produce strictly increasing values. We maintain a global 'prev' variable."
        },
        {
          title: "4. Iterative In-Order (Stack Simulation)",
          language: "python",
          code: `def isBST_InOrder_Iterative(root):
    stack = []
    prev = float('-inf')
    current = root
    
    while stack or current:
        while current:
            stack.append(current)
            current = current.left
            
        current = stack.pop()
        
        # Validation Logic
        if current.val <= prev:
            return False
        prev = current.val
        
        current = current.right
        
    return True`,
          explanation: "We push all left nodes to the stack. When we pop, we are visiting the node in sorted order. We validate that current.val > prev, update prev, and move to the right child."
        },
        {
          title: "5. Recursive Post-Order (Bottom-Up)",
          language: "python",
          code: `def isBST_PostOrder_Recursive(root):
    # Returns tuple: (is_valid, min_val, max_val)
    def validate(node):
        if not node:
            return (True, float('inf'), float('-inf'))
            
        left_valid, l_min, l_max = validate(node.left)
        right_valid, r_min, r_max = validate(node.right)
        
        if not left_valid or not right_valid:
            return (False, 0, 0)
            
        # Current node must be greater than max of left subtree
        if node.left and l_max >= node.val:
            return (False, 0, 0)
            
        # Current node must be less than min of right subtree
        if node.right and r_min <= node.val:
            return (False, 0, 0)
            
        # Calculate new range for this subtree
        curr_min = min(node.val, l_min)
        curr_max = max(node.val, r_max)
        
        return (True, curr_min, curr_max)

    return validate(root)[0]`,
          explanation: "This is a 'Bottom-Up' approach. Each node asks its children: 'Are you a BST, and what is your value range?'"
        },
        {
          title: "6. Iterative Post-Order (Bottom-Up using Hash Map)",
          language: "python",
          code: `def isBST_PostOrder_Iterative(root):
    if not root: 
        return True
        
    # Stack for traversal (Post-order logic)
    stack = [(root, False)] # (Node, visited_children)
    # Map to store {node: (min, max)} for processed nodes
    subtree_ranges = {} 
    
    while stack:
        node, visited = stack.pop()
        
        if node is None:
            continue
            
        if not visited:
            # First time seeing node: push back marked as visited, then push children
            stack.append((node, True))
            stack.append((node.right, False))
            stack.append((node.left, False))
        else:
            # Second time: Children are processed. Perform validation.
            l_min, l_max = subtree_ranges.get(node.left, (float('inf'), float('-inf')))
            r_min, r_max = subtree_ranges.get(node.right, (float('inf'), float('-inf')))
            
            # Validation
            if node.left and l_max >= node.val: return False
            if node.right and r_min <= node.val: return False
            
            # Compute current range
            curr_min = min(node.val, l_min)
            curr_max = max(node.val, r_max)
            subtree_ranges[node] = (curr_min, curr_max)
            
    return True`,
          explanation: "We use a hash map to store the (min, max) results of processed children because parents are visited last in Post-Order."
        }
      ]
    },
    {
      title: "C++20 Implementations",
      blocks: [
        {
          title: "1. Recursive Pre-Order (Range Constraint)",
          language: "cpp",
          code: `#include <limits>
#include <algorithm>

struct TreeNode {
    int val;
    TreeNode *left;
    TreeNode *right;
    TreeNode(int x) : val(x), left(nullptr), right(nullptr) {}
};

class Solution {
public:
    bool isBST_PreOrder_Recursive(TreeNode* root, 
                                  long long minVal = std::numeric_limits<long long>::min(), 
                                  long long maxVal = std::numeric_limits<long long>::max()) {
        if (!root) return true;
        
        if (root->val <= minVal || root->val >= maxVal) return false;
        
        return isBST_PreOrder_Recursive(root->left, minVal, root->val) &&
               isBST_PreOrder_Recursive(root->right, root->val, maxVal);
    }
};`,
          explanation: "Using 'long long' handles edge cases where node values equal INT_MAX. The logic is Top-Down constraint passing."
        },
        {
          title: "2. Iterative Pre-Order (Stack with Tuple)",
          language: "cpp",
          code: `#include <stack>
#include <tuple>

bool isBST_PreOrder_Iterative(TreeNode* root) {
    if (!root) return true;
    
    // Stack stores {node, lower_limit, upper_limit}
    std::stack<std::tuple<TreeNode*, long long, long long>> s;
    s.push({root, std::numeric_limits<long long>::min(), std::numeric_limits<long long>::max()});
    
    while (!s.empty()) {
        auto [node, low, high] = s.top();
        s.pop();
        
        if (node->val <= low || node->val >= high) return false;
        
        if (node->right) s.push({node->right, node->val, high});
        if (node->left)  s.push({node->left, low, node->val});
    }
    return true;
}`,
          explanation: "We utilize C++17/20 structured binding (auto [node, low, high]) to unpack the tuple cleanly."
        },
        {
          title: "3. Recursive In-Order (Sorted Check)",
          language: "cpp",
          code: `class Solution {
    long long prev = std::numeric_limits<long long>::min();
public:
    bool isBST_InOrder_Recursive(TreeNode* root) {
        if (!root) return true;
        
        if (!isBST_InOrder_Recursive(root->left)) return false;
        
        if (root->val <= prev) return false;
        prev = root->val;
        
        return isBST_InOrder_Recursive(root->right);
    }
};`,
          explanation: "Relies on the property that an in-order traversal of a BST yields a strictly increasing sequence."
        },
        {
          title: "4. Iterative In-Order (Stack Simulation)",
          language: "cpp",
          code: `bool isBST_InOrder_Iterative(TreeNode* root) {
    std::stack<TreeNode*> s;
    TreeNode* curr = root;
    long long prev = std::numeric_limits<long long>::min();
    
    while (curr != nullptr || !s.empty()) {
        while (curr != nullptr) {
            s.push(curr);
            curr = curr->left;
        }
        
        curr = s.top();
        s.pop();
        
        if (curr->val <= prev) return false;
        prev = curr->val;
        
        curr = curr->right;
    }
    return true;
}`,
          explanation: "Standard iterative DFS. We drill down to the leftmost node, process it (check vs prev), then move to the right child."
        },
        {
          title: "5. Recursive Post-Order (Bottom-Up Aggregation)",
          language: "cpp",
          code: `#include <utility>

struct ValidationResult {
    bool isBST;
    long long minVal;
    long long maxVal;
};

ValidationResult postOrder(TreeNode* root) {
    if (!root) return {true, std::numeric_limits<long long>::max(), std::numeric_limits<long long>::min()};
    
    auto left = postOrder(root->left);
    auto right = postOrder(root->right);
    
    if (!left.isBST || !right.isBST) return {false, 0, 0};
    
    if (root->left && left.maxVal >= root->val) return {false, 0, 0};
    if (root->right && right.minVal <= root->val) return {false, 0, 0};
    
    long long currentMin = std::min((long long)root->val, left.minVal);
    long long currentMax = std::max((long long)root->val, right.maxVal);
    
    return {true, currentMin, currentMax};
}

bool isBST_PostOrder_Recursive(TreeNode* root) {
    return postOrder(root).isBST;
}`,
          explanation: "We return a struct from the children containing validity status and range. The parent verifies if it fits between the max of the left child and the min of the right child."
        },
        {
          title: "6. Iterative Post-Order (Bottom-Up using Map)",
          language: "cpp",
          code: `#include <unordered_map>

bool isBST_PostOrder_Iterative(TreeNode* root) {
    if (!root) return true;
    
    std::stack<TreeNode*> s;
    s.push(root);
    TreeNode* prev = nullptr;
    
    // Map stores {node -> {min, max}}
    std::unordered_map<TreeNode*, std::pair<long long, long long>> rangeMap;
    
    while (!s.empty()) {
        TreeNode* curr = s.top();
        
        // If traversing down (and children exist)
        if (!prev || prev->left == curr || prev->right == curr) {
            if (curr->left) s.push(curr->left);
            else if (curr->right) s.push(curr->right);
            else { 
                // Leaf Node
                s.pop();
                rangeMap[curr] = {curr->val, curr->val};
            }
        } 
        // Traversing up from left child
        else if (curr->left == prev) {
            if (curr->right) s.push(curr->right);
            else {
                // Process Node (No right child)
                s.pop();
                long long lMax = rangeMap[curr->left].second;
                if (lMax >= curr->val) return false;
                
                long long lMin = rangeMap[curr->left].first;
                rangeMap[curr] = {std::min((long long)curr->val, lMin), curr->val};
            }
        }
        // Traversing up from right child (Process Node)
        else if (curr->right == prev) {
            s.pop();
            long long rMin = rangeMap[curr->right].first;
            if (rMin <= curr->val) return false;
            
            long long rMax = rangeMap[curr->right].second;
            long long lMin = curr->val;
            
            if (curr->left) {
                if (rangeMap[curr->left].second >= curr->val) return false;
                lMin = rangeMap[curr->left].first;
            }
            rangeMap[curr] = {lMin, std::max((long long)curr->val, rMax)};
        }
        prev = curr;
    }
    return true;
}`,
          explanation: "This uses the single-stack post-order traversal pattern using a 'prev' pointer to track direction."
        }
      ]
    }
  ]
};
