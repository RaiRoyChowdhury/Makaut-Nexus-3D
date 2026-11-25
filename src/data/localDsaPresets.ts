import {
  ExtractedClause,
  LogicMorphAnalysis,
  PresetProblemDefinition,
  ProgrammingLanguage,
} from "../types/logicMorph";

const BINARY_SEARCH_ARRAY = [2, 4, 7, 10, 13, 18, 21, 25, 30];
const BINARY_SEARCH_TARGET = 18;

const BINARY_SEARCH_FULL_CODE: Record<ProgrammingLanguage, string[]> = {
  c: [
    "int binarySearch(int arr[], int n, int target) {",
    "    int left = 0, right = n - 1;",
    "    while (left <= right) {",
    "        int mid = left + (right - left) / 2;",
    "        if (arr[mid] == target) {",
    "            return mid;",
    "        } else if (arr[mid] < target) {",
    "            left = mid + 1;",
    "        } else {",
    "            right = mid - 1;",
    "        }",
    "    }",
    "    return -1;",
    "}",
  ],
  python: [
    "def binary_search(arr: list[int], target: int) -> int:",
    "    left, right = 0, len(arr) - 1",
    "    while left <= right:",
    "        mid = left + (right - left) // 2",
    "        if arr[mid] == target:",
    "            return mid",
    "        elif arr[mid] < target:",
    "            left = mid + 1",
    "        else:",
    "            right = mid - 1",
    "    return -1",
  ],
  cpp: [
    "int binarySearch(const vector<int>& arr, int target) {",
    "    int left = 0, right = static_cast<int>(arr.size()) - 1;",
    "    while (left <= right) {",
    "        int mid = left + (right - left) / 2;",
    "        if (arr[mid] == target) {",
    "            return mid;",
    "        } else if (arr[mid] < target) {",
    "            left = mid + 1;",
    "        } else {",
    "            right = mid - 1;",
    "        }",
    "    }",
    "    return -1;",
    "}",
  ],
  java: [
    "public int binarySearch(int[] arr, int target) {",
    "    int left = 0, right = arr.length - 1;",
    "    while (left <= right) {",
    "        int mid = left + (right - left) / 2;",
    "        if (arr[mid] == target) {",
    "            return mid;",
    "        } else if (arr[mid] < target) {",
    "            left = mid + 1;",
    "        } else {",
    "            right = mid - 1;",
    "        }",
    "    }",
    "    return -1;",
    "}",
  ],
};

const BINARY_SEARCH_CLAUSES: ExtractedClause[] = [
  {
    clauseId: "bs-1",
    englishSpan: "Start with left at index 0 and right at the last index (n - 1).",
    logicRole: "initialization",
    status: "valid",
    codeLineIds: ["L2"],
    codeLines: {
      c: ["    int left = 0, right = n - 1;"],
      python: ["    left, right = 0, len(arr) - 1"],
      cpp: ["    int left = 0, right = static_cast<int>(arr.size()) - 1;"],
      java: ["    int left = 0, right = arr.length - 1;"],
    },
    syntaxTip: {
      c: "C arrays do not carry their length, so pass n explicitly and set right = n - 1 for 0-based indexing.",
      python: "Tuple unpacking assigns left = 0 and right = len(arr) - 1 cleanly in one line.",
      cpp: "Cast arr.size() (unsigned size_t) to int before subtracting 1 to avoid unsigned underflow on empty vectors.",
      java: "Arrays expose a .length field (without parentheses), unlike String.length() or List.size().",
    },
    practiceBlank: {
      c: {
        prompt: "int left = 0, right = n ____ 1;",
        tokens: ["-", "+", "*", "/"],
        correctToken: "-",
        hint: "Zero-based indexing means the final valid index is one less than the array length.",
        explanation: "Because indices run from 0 to n - 1, right starts at n - 1.",
      },
      python: {
        prompt: "left, right = 0, ____(arr) - 1",
        tokens: ["len", "size", "count", "length"],
        correctToken: "len",
        hint: "Use Python's built-in sequence length function.",
        explanation: "len(arr) returns the item count, so len(arr) - 1 is the final index.",
      },
      cpp: {
        prompt: "int left = 0, right = static_cast<int>(arr.____()) - 1;",
        tokens: ["size", "length", "count", "len"],
        correctToken: "size",
        hint: "std::vector exposes a member method returning element count.",
        explanation: "arr.size() returns the number of elements in a C++ std::vector.",
      },
      java: {
        prompt: "int left = 0, right = arr.____ - 1;",
        tokens: ["length", "size()", "length()", "count"],
        correctToken: "length",
        hint: "Java primitive arrays use a public property, not a method call.",
        explanation: "arr.length reads the array capacity field in Java.",
      },
    },
    mathXRay: {
      formulaTitle: "Closed Search Interval [left, right]",
      whyItWorks:
        "Setting left = 0 and right = n - 1 establishes an inclusive search interval containing all n sorted elements.",
      substitutionSteps: [
        "n = 9 elements in [2, 4, 7, 10, 13, 18, 21, 25, 30]",
        "left = 0 (arr[0] = 2)",
        "right = 9 - 1 = 8 (arr[8] = 30)",
        "Active candidate count = 8 - 0 + 1 = 9",
      ],
      boundaryIntuition:
        "Using inclusive bounds [left, right] pairs naturally with the condition while (left <= right).",
      intuition:
        "Zero extra heap memory is allocated; two integer registers track the shrinking sub-array.",
    },
    visualState: {
      mode: "array",
      array: BINARY_SEARCH_ARRAY,
      target: BINARY_SEARCH_TARGET,
      pointers: { left: 0, right: 8 },
      eliminatedIndices: [],
      highlightIndices: [0, 8],
      variables: { left: 0, right: 8, target: 18, intervalSize: 9 },
      callOrStateNote: "Initialized inclusive search bounds across indices [0..8].",
    },
  },
  {
    clauseId: "bs-2",
    englishSpan: "While left <= right, compute mid = left + (right - left) / 2 safely without overflow.",
    logicRole: "iteration",
    status: "valid",
    codeLineIds: ["L3", "L4"],
    codeLines: {
      c: ["    while (left <= right) {", "        int mid = left + (right - left) / 2;"],
      python: ["    while left <= right:", "        mid = left + (right - left) // 2"],
      cpp: ["    while (left <= right) {", "        int mid = left + (right - left) / 2;"],
      java: ["    while (left <= right) {", "        int mid = left + (right - left) / 2;"],
    },
    syntaxTip: {
      c: "Integer division '/' truncates fractional remainders automatically for int operands in C.",
      python: "Use '//' for integer floor division in Python; single '/' returns a float which cannot index a list.",
      cpp: "left + (right - left) / 2 prevents signed 32-bit overflow when left + right exceeds INT_MAX.",
      java: "Java int is fixed 32-bit signed, so left + (right - left) / 2 prevents overflow on huge arrays.",
    },
    practiceBlank: {
      c: {
        prompt: "int mid = left + (right - left) / ____;",
        tokens: ["2", "4", "n", "right"],
        correctToken: "2",
        hint: "Binary search halves the remaining search space every iteration.",
        explanation: "Dividing the interval length (right - left) by 2 lands on the midpoint offset.",
      },
      python: {
        prompt: "mid = left + (right - left) ____ 2",
        tokens: ["//", "/", "%", "**"],
        correctToken: "//",
        hint: "Array indices in Python must be integers, not floating-point numbers.",
        explanation: "Floor division '//' produces an integer index directly in Python.",
      },
      cpp: {
        prompt: "while (left ____ right) {",
        tokens: ["<=", "<", "!=", ">="],
        correctToken: "<=",
        hint: "When left == right, there is still one unchecked element inside [left, right].",
        explanation: "left <= right ensures single-element intervals are still inspected.",
      },
      java: {
        prompt: "int mid = ____ + (right - left) / 2;",
        tokens: ["left", "0", "right", "target"],
        correctToken: "left",
        hint: "Add the half-interval offset back to the start of the active window.",
        explanation: "Adding left converts the relative midpoint offset into a valid array index.",
      },
    },
    mathXRay: {
      formulaTitle: "Overflow-Safe Midpoint: mid = left + (right - left) / 2",
      whyItWorks:
        "Subtracting left from right gives the interval length, dividing by 2 finds its halfway offset, and adding left shifts that offset back into the global array index.",
      substitutionSteps: [
        "left = 0, right = 8",
        "mid = 0 + (8 - 0) / 2",
        "mid = 0 + 4 = 4",
        "Inspect arr[4] = 13 against target = 18",
      ],
      boundaryIntuition:
        "Using left + (right - left) / 2 avoids signed 32-bit integer overflow that (left + right) / 2 can cause when both indices exceed 2^30.",
      intuition:
        "Halving at mid cuts the candidate interval by >= 50% on every step, guaranteeing O(log n) iterations.",
    },
    visualState: {
      mode: "array",
      array: BINARY_SEARCH_ARRAY,
      target: BINARY_SEARCH_TARGET,
      pointers: { left: 0, right: 8, mid: 4 },
      eliminatedIndices: [],
      highlightIndices: [4],
      variables: { left: 0, right: 8, mid: 4, "arr[mid]": 13, target: 18 },
      callOrStateNote: "Pass 1: midpoint index 4 holds value 13.",
    },
  },
  {
    clauseId: "bs-3",
    englishSpan: "If arr[mid] equals target return mid; if arr[mid] < target shift left = mid + 1.",
    logicRole: "comparison",
    status: "valid",
    codeLineIds: ["L5", "L6", "L7", "L8"],
    codeLines: {
      c: [
        "        if (arr[mid] == target) {",
        "            return mid;",
        "        } else if (arr[mid] < target) {",
        "            left = mid + 1;",
      ],
      python: [
        "        if arr[mid] == target:",
        "            return mid",
        "        elif arr[mid] < target:",
        "            left = mid + 1",
      ],
      cpp: [
        "        if (arr[mid] == target) {",
        "            return mid;",
        "        } else if (arr[mid] < target) {",
        "            left = mid + 1;",
      ],
      java: [
        "        if (arr[mid] == target) {",
        "            return mid;",
        "        } else if (arr[mid] < target) {",
        "            left = mid + 1;",
      ],
    },
    syntaxTip: {
      c: "Use == for equality comparison; a single = performs assignment and is a classic C bug.",
      python: "Python uses elif instead of else if for chained conditional branches.",
      cpp: "Always compare arr[mid] before advancing left = mid + 1 so mid itself is excluded cleanly.",
      java: "Updating left = mid + 1 guarantees strict forward progress so the loop always terminates.",
    },
    practiceBlank: {
      c: {
        prompt: "left = mid ____ 1;",
        tokens: ["+", "-", "*", "/"],
        correctToken: "+",
        hint: "Since arr[mid] was strictly smaller than target, mid itself cannot be the answer.",
        explanation: "left = mid + 1 discards indices 0..mid and searches strictly to the right.",
      },
      python: {
        prompt: "____ arr[mid] < target:",
        tokens: ["elif", "else if", "elseif", "when"],
        correctToken: "elif",
        hint: "Python has a 4-letter keyword combining else + if.",
        explanation: "Python spells chained conditionals as elif.",
      },
      cpp: {
        prompt: "if (arr[mid] ____ target) { return mid; }",
        tokens: ["==", "=", "===", "<="],
        correctToken: "==",
        hint: "Use the C++ equality operator, not assignment.",
        explanation: "arr[mid] == target tests equality without mutating the array.",
      },
      java: {
        prompt: "left = ____ + 1;",
        tokens: ["mid", "left", "right", "0"],
        correctToken: "mid",
        hint: "Jump just past the inspected midpoint.",
        explanation: "Advancing left to mid + 1 shrinks the interval strictly.",
      },
    },
    mathXRay: {
      formulaTitle: "Sorted Monotonicity Elimination: arr[mid] < target ⇒ target ∉ [left, mid]",
      whyItWorks:
        "Because the array is sorted in non-decreasing order, every value at index ≤ mid is also ≤ arr[mid] < target, making the entire left half impossible.",
      substitutionSteps: [
        "arr[4] = 13 < 18 (target)",
        "Discard indices 0..4 ([2, 4, 7, 10, 13])",
        "left = mid + 1 = 4 + 1 = 5",
        "New interval becomes [5, 8] → [18, 21, 25, 30]",
      ],
      boundaryIntuition:
        "Setting left = mid + 1 (not mid) avoids an infinite loop when left and right differ by 1.",
      intuition:
        "5 elements eliminated in a single comparison.",
    },
    visualState: {
      mode: "array",
      array: BINARY_SEARCH_ARRAY,
      target: BINARY_SEARCH_TARGET,
      pointers: { left: 5, right: 8, mid: 4 },
      eliminatedIndices: [0, 1, 2, 3, 4],
      highlightIndices: [5, 6, 7, 8],
      variables: { left: 5, right: 8, "arr[4]": 13, comparison: "13 < 18" },
      callOrStateNote: "13 < 18: left half [0..4] discarded; left jumps to 5.",
    },
  },
  {
    clauseId: "bs-4",
    englishSpan: "Otherwise arr[mid] > target, so move right = mid - 1 to search the left half.",
    logicRole: "update",
    status: "valid",
    codeLineIds: ["L9", "L10", "L11"],
    codeLines: {
      c: ["        } else {", "            right = mid - 1;", "        }"],
      python: ["        else:", "            right = mid - 1"],
      cpp: ["        } else {", "            right = mid - 1;", "        }"],
      java: ["        } else {", "            right = mid - 1;", "        }"],
    },
    syntaxTip: {
      c: "Closing braces align cleanly with the matching if/else branch for readable control flow.",
      python: "Python relies on 4-space indentation instead of curly braces to group the else block.",
      cpp: "right = mid - 1 shrinks the upper bound cleanly; if mid == 0, right becomes -1 and terminates the loop.",
      java: "The else branch executes only when arr[mid] > target since == and < were handled above.",
    },
    practiceBlank: {
      c: {
        prompt: "right = mid ____ 1;",
        tokens: ["-", "+", "*", "="],
        correctToken: "-",
        hint: "Target is smaller than arr[mid], so shrink the right boundary leftward.",
        explanation: "right = mid - 1 discards mid and everything to its right.",
      },
      python: {
        prompt: "right = ____ - 1",
        tokens: ["mid", "right", "left", "len(arr)"],
        correctToken: "mid",
        hint: "Move the upper boundary just below the tested midpoint.",
        explanation: "right = mid - 1 narrows the interval to [left, mid - 1].",
      },
      cpp: {
        prompt: "right = mid - ____;",
        tokens: ["1", "2", "left", "0"],
        correctToken: "1",
        hint: "We already checked index mid, so step left by one position.",
        explanation: "Decrementing by 1 excludes mid from the next iteration.",
      },
      java: {
        prompt: "____ = mid - 1;",
        tokens: ["right", "left", "mid", "target"],
        correctToken: "right",
        hint: "Update the upper pointer when arr[mid] exceeds target.",
        explanation: "Moving right inward reduces the upper half of the search window.",
      },
    },
    mathXRay: {
      formulaTitle: "Upper-Half Pruning: arr[mid] > target ⇒ right = mid - 1",
      whyItWorks:
        "On Pass 2 over [5, 8], mid becomes 6 (arr[6] = 21). Because 21 > 18, indices 6..8 are all ≥ 21 > 18 and can be discarded immediately.",
      substitutionSteps: [
        "left = 5, right = 8",
        "mid = 5 + (8 - 5) / 2 = 6 → arr[6] = 21",
        "21 > 18 ⇒ discard [6..8]",
        "right = 6 - 1 = 5 → interval narrows to [5, 5]",
      ],
      boundaryIntuition:
        "Notice left == right == 5 is now a 1-element window — proving why while (left <= right) is required!",
      intuition:
        "Only 1 candidate index remains after two comparisons out of 9.",
    },
    visualState: {
      mode: "array",
      array: BINARY_SEARCH_ARRAY,
      target: BINARY_SEARCH_TARGET,
      pointers: { left: 5, right: 5, mid: 6 },
      eliminatedIndices: [0, 1, 2, 3, 4, 6, 7, 8],
      highlightIndices: [5],
      variables: { left: 5, right: 5, mid: 6, "arr[6]": 21, comparison: "21 > 18" },
      callOrStateNote: "Pass 2: arr[6] = 21 > 18, so right moves to 5. Interval is [5..5].",
    },
  },
  {
    clauseId: "bs-5",
    englishSpan: "When arr[mid] matches 18 return mid; if the loop exits without finding target, return -1.",
    logicRole: "return",
    status: "valid",
    codeLineIds: ["L5", "L6", "L13"],
    codeLines: {
      c: ["    return -1;"],
      python: ["    return -1"],
      cpp: ["    return -1;"],
      java: ["    return -1;"],
    },
    syntaxTip: {
      c: "Returning -1 is the universal C sentinel for 'index not found' since valid indices are >= 0.",
      python: "Returning -1 matches standard search conventions when the integer index does not exist.",
      cpp: "Ensure all execution paths return an int so the compiler does not warn about missing return values.",
      java: "Java requires a guaranteed return statement after the while loop for non-void methods.",
    },
    practiceBlank: {
      c: {
        prompt: "return ____;",
        tokens: ["-1", "0", "mid", "NULL"],
        correctToken: "-1",
        hint: "Pick the standard integer sentinel for 'element absent'.",
        explanation: "Returning -1 clearly signals that target is not in the array.",
      },
      python: {
        prompt: "return ____",
        tokens: ["-1", "None", "0", "False"],
        correctToken: "-1",
        hint: "Match the function's -> int return type annotation for missing targets.",
        explanation: "Returning -1 preserves a consistent integer return type.",
      },
      cpp: {
        prompt: "return ____;",
        tokens: ["-1", "false", "nullptr", "0"],
        correctToken: "-1",
        hint: "0 is a valid first index, so pick an invalid index sentinel.",
        explanation: "-1 cannot collide with valid 0-based array indices.",
      },
      java: {
        prompt: "return ____;",
        tokens: ["-1", "null", "0", "-2"],
        correctToken: "-1",
        hint: "Matches Java's Arrays.binarySearch negative miss convention.",
        explanation: "-1 signals target absence in an int-returning search method.",
      },
    },
    mathXRay: {
      formulaTitle: "Final Convergence & Miss Termination",
      whyItWorks:
        "On Pass 3 over [5, 5], mid = 5 + (5 - 5) / 2 = 5. arr[5] == 18 matches target, returning index 5. If target were absent, left would cross right (left > right) and exit to return -1.",
      substitutionSteps: [
        "left = 5, right = 5",
        "mid = 5 + (5 - 5) / 2 = 5",
        "arr[5] == 18 (match!)",
        "Return index 5 in 3 iterations (log2(9) ≈ 3.17)",
      ],
      boundaryIntuition:
        "Loop invariant: if target exists in arr, it always lies inside [left, right]. Empty [left, right] proves absence.",
      intuition:
        "Worst-case work on 1,000,000 elements is at most 20 comparisons.",
    },
    visualState: {
      mode: "array",
      array: BINARY_SEARCH_ARRAY,
      target: BINARY_SEARCH_TARGET,
      pointers: { left: 5, right: 5, mid: 5 },
      eliminatedIndices: [0, 1, 2, 3, 4, 6, 7, 8],
      highlightIndices: [5],
      variables: { left: 5, right: 5, mid: 5, "arr[5]": 18, result: "FOUND @ 5" },
      callOrStateNote: "Match! arr[5] == 18. Binary Search returns index 5.",
    },
  },
];

const TWO_SUM_ARRAY = [2, 7, 11, 15];
const TWO_SUM_TARGET = 9;

const TWO_SUM_FULL_CODE: Record<ProgrammingLanguage, string[]> = {
  c: [
    "void twoSumSorted(int numbers[], int n, int target, int out[2]) {",
    "    int left = 0, right = n - 1;",
    "    while (left < right) {",
    "        int sum = numbers[left] + numbers[right];",
    "        if (sum == target) {",
    "            out[0] = left + 1; out[1] = right + 1; return;",
    "        } else if (sum < target) {",
    "            left++;",
    "        } else {",
    "            right--;",
    "        }",
    "    }",
    "}",
  ],
  python: [
    "def two_sum(numbers: list[int], target: int) -> list[int]:",
    "    left, right = 0, len(numbers) - 1",
    "    while left < right:",
    "        curr_sum = numbers[left] + numbers[right]",
    "        if curr_sum == target:",
    "            return [left + 1, right + 1]",
    "        elif curr_sum < target:",
    "            left += 1",
    "        else:",
    "            right -= 1",
    "    return []",
  ],
  cpp: [
    "vector<int> twoSum(const vector<int>& numbers, int target) {",
    "    int left = 0, right = static_cast<int>(numbers.size()) - 1;",
    "    while (left < right) {",
    "        int sum = numbers[left] + numbers[right];",
    "        if (sum == target) {",
    "            return {left + 1, right + 1};",
    "        } else if (sum < target) {",
    "            left++;",
    "        } else {",
    "            right--;",
    "        }",
    "    }",
    "    return {};",
    "}",
  ],
  java: [
    "public int[] twoSum(int[] numbers, int target) {",
    "    int left = 0, right = numbers.length - 1;",
    "    while (left < right) {",
    "        int sum = numbers[left] + numbers[right];",
    "        if (sum == target) {",
    "            return new int[] { left + 1, right + 1 };",
    "        } else if (sum < target) {",
    "            left++;",
    "        } else {",
    "            right--;",
    "        }",
    "    }",
    "    return new int[0];",
    "}",
  ],
};

const TWO_SUM_CLAUSES: ExtractedClause[] = [
  {
    clauseId: "ts-1",
    englishSpan: "Initialize left pointer at index 0 and right pointer at the end (n - 1).",
    logicRole: "initialization",
    status: "valid",
    codeLineIds: ["L2"],
    codeLines: {
      c: ["    int left = 0, right = n - 1;"],
      python: ["    left, right = 0, len(numbers) - 1"],
      cpp: ["    int left = 0, right = static_cast<int>(numbers.size()) - 1;"],
      java: ["    int left = 0, right = numbers.length - 1;"],
    },
    syntaxTip: {
      c: "Use two index variables instead of pointer arithmetic if you need 1-indexed positions at the end.",
      python: "Simultaneous assignment sets both ends of the sorted list cleanly.",
      cpp: "Pass numbers by const reference (const vector<int>&) to avoid copying the entire vector.",
      java: "Use strict left < right in Two Sum II because the same element cannot be used twice.",
    },
    practiceBlank: {
      c: {
        prompt: "while (left ____ right) {",
        tokens: ["<", "<=", "==", ">"],
        correctToken: "<",
        hint: "A valid pair requires two distinct indices.",
        explanation: "left < right prevents pairing an element with itself.",
      },
      python: {
        prompt: "while left ____ right:",
        tokens: ["<", "<=", "!=", ">="],
        correctToken: "<",
        hint: "Two Sum II requires two distinct elements.",
        explanation: "Strict inequality guarantees left and right point to different indices.",
      },
      cpp: {
        prompt: "while (left ____ right) {",
        tokens: ["<", "<=", ">", "!="],
        correctToken: "<",
        hint: "Stop as soon as the pointers meet.",
        explanation: "Using left < right ensures two distinct positions are summed.",
      },
      java: {
        prompt: "while (left ____ right) {",
        tokens: ["<", "<=", ">=", "=="],
        correctToken: "<",
        hint: "You cannot add numbers[i] to itself.",
        explanation: "Strict < ensures left != right on every pair test.",
      },
    },
    mathXRay: {
      formulaTitle: "Extremal Pair Initialization: (min, max) = (numbers[0], numbers[n - 1])",
      whyItWorks:
        "Starting at opposite ends gives us the smallest + largest element pair. From here, every sum error tells us unambiguously which pointer to move.",
      substitutionSteps: [
        "numbers = [2, 7, 11, 15], target = 9",
        "left = 0 → numbers[0] = 2 (smallest)",
        "right = 3 → numbers[3] = 15 (largest)",
      ],
      boundaryIntuition:
        "Because you cannot reuse the same index, the loop invariant requires left < right.",
      intuition:
        "Two pointers replace O(n^2) nested loops or O(n) hash maps with O(1) extra space.",
    },
    visualState: {
      mode: "two_pointers",
      array: TWO_SUM_ARRAY,
      target: TWO_SUM_TARGET,
      pointers: { left: 0, right: 3 },
      highlightIndices: [0, 3],
      variables: { left: 0, right: 3, target: 9 },
      callOrStateNote: "Pointers placed at opposite extremes: index 0 (2) and index 3 (15).",
    },
  },
  {
    clauseId: "ts-2",
    englishSpan: "Compute the pair sum = numbers[left] + numbers[right] while left < right.",
    logicRole: "comparison",
    status: "valid",
    codeLineIds: ["L3", "L4"],
    codeLines: {
      c: ["    while (left < right) {", "        int sum = numbers[left] + numbers[right];"],
      python: ["    while left < right:", "        curr_sum = numbers[left] + numbers[right]"],
      cpp: ["    while (left < right) {", "        int sum = numbers[left] + numbers[right];"],
      java: ["    while (left < right) {", "        int sum = numbers[left] + numbers[right];"],
    },
    syntaxTip: {
      c: "Storing sum in a local variable avoids recomputing numbers[left] + numbers[right] across branches.",
      python: "Avoid naming a variable 'sum' in Python so you don't shadow the built-in sum() function.",
      cpp: "Local int sum fits in a CPU register for fast multi-branch comparisons.",
      java: "Cache numbers[left] + numbers[right] once per iteration for clean, readable branching.",
    },
    practiceBlank: {
      c: {
        prompt: "int sum = numbers[left] ____ numbers[right];",
        tokens: ["+", "-", "*", "/"],
        correctToken: "+",
        hint: "We are testing the total of the two selected elements.",
        explanation: "Add numbers[left] and numbers[right] to compare against target.",
      },
      python: {
        prompt: "curr_sum = numbers[____] + numbers[right]",
        tokens: ["left", "0", "target", "1"],
        correctToken: "left",
        hint: "Combine the element at the lower pointer with numbers[right].",
        explanation: "numbers[left] + numbers[right] gives the current candidate pair sum.",
      },
      cpp: {
        prompt: "int sum = numbers[left] + numbers[____];",
        tokens: ["right", "left", "n", "target"],
        correctToken: "right",
        hint: "Pair the left value with the upper boundary element.",
        explanation: "numbers[right] supplies the larger term in the candidate pair.",
      },
      java: {
        prompt: "int sum = ____[left] + numbers[right];",
        tokens: ["numbers", "target", "out", "arr"],
        correctToken: "numbers",
        hint: "Index into the input array parameter.",
        explanation: "numbers[left] reads the value at the left pointer.",
      },
    },
    mathXRay: {
      formulaTitle: "Candidate Sum Test: S = numbers[left] + numbers[right]",
      whyItWorks:
        "Testing the sum of the current extremes tells us whether our pair is too heavy (> target), too light (< target), or exact.",
      substitutionSteps: [
        "left = 0 (2), right = 3 (15)",
        "sum = 2 + 15 = 17",
        "Compare 17 vs target 9 → 17 > 9 (too large)",
      ],
      boundaryIntuition:
        "Any number added to 15 with index ≥ 0 gives sum ≥ 2 + 15 = 17 > 9, so 15 can never participate in a valid pair!",
      intuition:
        "One sum check eliminates an entire row/column of the pair matrix.",
    },
    visualState: {
      mode: "two_pointers",
      array: TWO_SUM_ARRAY,
      target: TWO_SUM_TARGET,
      pointers: { left: 0, right: 3 },
      highlightIndices: [0, 3],
      variables: { left: 0, right: 3, sum: 17, target: 9 },
      callOrStateNote: "Step 1: 2 + 15 = 17 > 9. Pair sum exceeds target.",
    },
  },
  {
    clauseId: "ts-3",
    englishSpan: "If sum < target move left rightward (left++); if sum > target move right leftward (right--).",
    logicRole: "update",
    status: "valid",
    codeLineIds: ["L7", "L8", "L9", "L10"],
    codeLines: {
      c: ["        } else if (sum < target) {", "            left++;", "        } else {", "            right--;"],
      python: ["        elif curr_sum < target:", "            left += 1", "        else:", "            right -= 1"],
      cpp: ["        } else if (sum < target) {", "            left++;", "        } else {", "            right--;"],
      java: ["        } else if (sum < target) {", "            left++;", "        } else {", "            right--;"],
    },
    syntaxTip: {
      c: "C supports post-increment left++ and post-decrement right-- directly on index counters.",
      python: "Python does not have ++ or -- operators; write left += 1 and right -= 1 instead.",
      cpp: "Incrementing left increases the sum; decrementing right decreases the sum due to sorted order.",
      java: "Each iteration moves left or right by 1, guaranteeing at most n - 1 iterations.",
    },
    practiceBlank: {
      c: {
        prompt: "} else { right____; }",
        tokens: ["--", "++", "+=2", "=0"],
        correctToken: "--",
        hint: "When sum > target, we need a smaller total from the sorted array.",
        explanation: "right-- moves to a smaller element, reducing the pair sum.",
      },
      python: {
        prompt: "elif curr_sum < target:\n    left ____ 1",
        tokens: ["+=", "-=", "=", "++"],
        correctToken: "+=",
        hint: "Python updates integers with augmented assignment, not ++.",
        explanation: "left += 1 steps the left pointer rightward to increase the sum.",
      },
      cpp: {
        prompt: "} else if (sum < target) { ____++; }",
        tokens: ["left", "right", "sum", "target"],
        correctToken: "left",
        hint: "When the sum is too small, shift the smaller number upward.",
        explanation: "Advancing left increases numbers[left] in a sorted array.",
      },
      java: {
        prompt: "} else { ____--; }",
        tokens: ["right", "left", "target", "sum"],
        correctToken: "right",
        hint: "Decrease the upper bound when sum > target.",
        explanation: "right-- steps leftward to decrease the sum.",
      },
    },
    mathXRay: {
      formulaTitle: "Sorted Search-Space Reduction: sum > target ⇒ right--",
      whyItWorks:
        "Because numbers is sorted, moving left right strictly increases (or preserves) the sum, while moving right left strictly decreases (or preserves) the sum.",
      substitutionSteps: [
        "17 > 9 ⇒ decrement right from 3 to 2 (11)",
        "Next sum = 2 + 11 = 13 > 9 ⇒ decrement right from 2 to 1 (7)",
        "Active window shrinks to [0, 1] → [2, 7]",
      ],
      boundaryIntuition:
        "Every step eliminates 1 candidate without ever skipping the unique solution pair.",
      intuition:
        "Notice how 15 and 11 are pruned in O(1) each without touching a hash table.",
    },
    visualState: {
      mode: "two_pointers",
      array: TWO_SUM_ARRAY,
      target: TWO_SUM_TARGET,
      pointers: { left: 0, right: 1 },
      eliminatedIndices: [2, 3],
      highlightIndices: [0, 1],
      variables: { left: 0, right: 1, prevSum: "13 > 9", nextPair: "2 + 7" },
      callOrStateNote: "15 and 11 pruned via right--; pointers now frame [2, 7].",
    },
  },
  {
    clauseId: "ts-4",
    englishSpan: "When sum equals target, return the 1-indexed positions [left + 1, right + 1].",
    logicRole: "return",
    status: "valid",
    codeLineIds: ["L5", "L6"],
    codeLines: {
      c: ["        if (sum == target) {", "            out[0] = left + 1; out[1] = right + 1; return;"],
      python: ["        if curr_sum == target:", "            return [left + 1, right + 1]"],
      cpp: ["        if (sum == target) {", "            return {left + 1, right + 1};"],
      java: ["        if (sum == target) {", "            return new int[] { left + 1, right + 1 };"],
    },
    syntaxTip: {
      c: "C functions cannot return fixed-size arrays directly by value, so write 1-indexed results into an output buffer out[2].",
      python: "Return a 2-element list literal [left + 1, right + 1] matching LeetCode's 1-based convention.",
      cpp: "Braced initializer return {left + 1, right + 1}; constructs std::vector<int> cleanly.",
      java: "Use anonymous array syntax new int[] { left + 1, right + 1 } to return an int array.",
    },
    practiceBlank: {
      c: {
        prompt: "out[0] = left + 1; out[1] = right + ____;",
        tokens: ["1", "0", "2", "-1"],
        correctToken: "1",
        hint: "LeetCode Two Sum II uses 1-indexed positions rather than 0-indexed.",
        explanation: "Adding 1 converts 0-based array index right into 1-based position.",
      },
      python: {
        prompt: "return [left + ____, right + 1]",
        tokens: ["1", "0", "2", "-1"],
        correctToken: "1",
        hint: "Convert 0-based index left to 1-indexed position.",
        explanation: "Index 0 becomes position 1, and index 1 becomes position 2.",
      },
      cpp: {
        prompt: "return {left + 1, ____ + 1};",
        tokens: ["right", "left", "target", "sum"],
        correctToken: "right",
        hint: "Include both 1-indexed endpoints of the matched pair.",
        explanation: "Returning {left + 1, right + 1} gives [1, 2] for [2, 7].",
      },
      java: {
        prompt: "return new int[] { left + 1, right + ____ };",
        tokens: ["1", "0", "left", "2"],
        correctToken: "1",
        hint: "Shift both 0-based indices by +1.",
        explanation: "Two Sum II specifies 1-indexed positions [index1, index2].",
      },
    },
    mathXRay: {
      formulaTitle: "1-Indexed Answer Mapping: (0-based + 1)",
      whyItWorks:
        "Arrays in C/Python/C++/Java start at index 0, whereas Two Sum II defines the first element as index 1. Adding 1 to both pointers yields [1, 2].",
      substitutionSteps: [
        "left = 0 (numbers[0] = 2), right = 1 (numbers[1] = 7)",
        "sum = 2 + 7 = 9 == target",
        "1-indexed output = [0 + 1, 1 + 1] = [1, 2]",
      ],
      boundaryIntuition:
        "Guaranteed unique answer per LeetCode 167 constraints; pointers stop as soon as sum == target.",
      intuition:
        "Total runtime O(n) with strictly O(1) auxiliary space.",
    },
    visualState: {
      mode: "two_pointers",
      array: TWO_SUM_ARRAY,
      target: TWO_SUM_TARGET,
      pointers: { left: 0, right: 1 },
      eliminatedIndices: [2, 3],
      highlightIndices: [0, 1],
      variables: { left: 0, right: 1, sum: "9 == 9", output: "[1, 2]" },
      callOrStateNote: "Match! 2 + 7 = 9. Returns 1-indexed positions [1, 2].",
    },
  },
];

export const PRESET_PROBLEMS: PresetProblemDefinition[] = [
  {
    id: "binary-search",
    title: "Binary Search",
    category: "Binary Search",
    problemStatement:
      "Given a sorted array of distinct integers arr and an integer target, return the 0-based index of target if found, otherwise return -1 in O(log n) time.",
    exampleInput: "arr = [2, 4, 7, 10, 13, 18, 21, 25, 30], target = 18",
    expectedOutput: "5",
    defaultEnglishLogic: [
      "Start with left at index 0 and right at the last index (n - 1).",
      "While left <= right, compute mid = left + (right - left) / 2 safely without overflow.",
      "If arr[mid] equals target return mid; if arr[mid] < target shift left = mid + 1.",
      "Otherwise arr[mid] > target, so move right = mid - 1 to search the left half.",
      "When arr[mid] matches 18 return mid; if the loop exits without finding target, return -1.",
    ].join("\n"),
    analysis: {
      problemTitle: "Binary Search",
      problemCategory: "Binary Search",
      algorithmName: "Iterative Binary Search",
      detectedLanguage: "Plain English",
      problemSummary:
        "Repeatedly halve a sorted interval [left, right] by comparing the middle element against target.",
      exampleInput: "arr = [2, 4, 7, 10, 13, 18, 21, 25, 30], target = 18",
      expectedOutput: "5",
      extractedClauses: BINARY_SEARCH_CLAUSES,
      fullCode: BINARY_SEARCH_FULL_CODE,
      edgeCases: [
        "Empty array (n == 0) → right = -1, loop immediately skips and returns -1",
        "Single-element array ([18], target = 18) → requires while (left <= right)",
        "Large indices (> 2^30) → left + (right - left) / 2 prevents signed overflow",
      ],
      complexity: {
        time: "O(log n)",
        space: "O(1)",
        explanation:
          "Each comparison eliminates at least half of the remaining candidates while using only constant index variables.",
      },
      source: "preset",
      analyzedScope: "full",
      analyzedText: "",
    },
  },
  {
    id: "two-sum-ii",
    title: "Two Sum II — Input Array Is Sorted",
    category: "Two Pointers",
    problemStatement:
      "Given a 1-indexed sorted integer array numbers, find two numbers at distinct indices that add up to target and return [index1, index2] using O(1) extra space.",
    exampleInput: "numbers = [2, 7, 11, 15], target = 9",
    expectedOutput: "[1, 2]",
    defaultEnglishLogic: [
      "Initialize left pointer at index 0 and right pointer at the end (n - 1).",
      "Compute the pair sum = numbers[left] + numbers[right] while left < right.",
      "If sum < target move left rightward (left++); if sum > target move right leftward (right--).",
      "When sum equals target, return the 1-indexed positions [left + 1, right + 1].",
    ].join("\n"),
    analysis: {
      problemTitle: "Two Sum II — Input Array Is Sorted",
      problemCategory: "Two Pointers",
      algorithmName: "Opposite-End Two Pointers",
      detectedLanguage: "Plain English",
      problemSummary:
        "Converge two pointers from opposite ends of a sorted array by steering the sum up or down.",
      exampleInput: "numbers = [2, 7, 11, 15], target = 9",
      expectedOutput: "[1, 2]",
      extractedClauses: TWO_SUM_CLAUSES,
      fullCode: TWO_SUM_FULL_CODE,
      edgeCases: [
        "Two-element array ([3, 3], target = 6) → strict left < right prevents self-pairing",
        "Negative values in sorted array ([-4, -1, 0, 5], target = 1) → pointer steering still holds",
        "1-indexed output required by problem spec → return [left + 1, right + 1]",
      ],
      complexity: {
        time: "O(n)",
        space: "O(1)",
        explanation:
          "Each pointer moves monotonically inward at most n - 1 total steps with zero auxiliary data structures.",
      },
      source: "preset",
      analyzedScope: "full",
      analyzedText: "",
    },
  },
];

export interface DetectedBugWarning {
  clauseIndex: number;
  snippet: string;
  warningMessage: string;
  whyItCanFail: string;
  suggestedFix: string;
  certainty: "confirmed" | "suggestion";
}

export function detectGentleBugsInLogic(logicText: string): DetectedBugWarning[] {
  const lines = logicText
    .split(/\r?\n|(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const warnings: DetectedBugWarning[] = [];

  lines.forEach((line, idx) => {
    const lower = line.toLowerCase();

    // 1. Overflow check: (left + right) / 2 or (low + high) / 2
    if (/\(\s*(left|low|l)\s*\+\s*(right|high|r)\s*\)\s*\/\s*2/i.test(line)) {
      warnings.push({
        clauseIndex: idx,
        snippet: line,
        warningMessage: "Potential integer overflow in midpoint calculation",
        whyItCanFail:
          "In 32-bit signed integers (C, C++, Java), adding two large indices (left + right) before dividing can overflow past 2^31 - 1 and produce a negative index.",
        suggestedFix: line.replace(
          /\(\s*(left|low|l)\s*\+\s*(right|high|r)\s*\)\s*\/\s*2/i,
          "$1 + ($2 - $1) / 2"
        ),
        certainty: "confirmed",
      });
    }

    // 2. Binary search boundary left < right with right = mid - 1
    if (
      /while\s+.*(left|low)\s*<\s*(right|high)/i.test(line) &&
      lower.includes("binary")
    ) {
      warnings.push({
        clauseIndex: idx,
        snippet: line,
        warningMessage: "Loop may skip single-element interval when left == right",
        whyItCanFail:
          "With inclusive right = n - 1, using strict '<' exits early when left meets right, missing a target located at that final element.",
        suggestedFix: line.replace(/<\s*(right|high)/i, "<= $1"),
        certainty: "suggestion",
      });
    }

    // 3. Off-by-one right = n
    if (/\b(right|high)\s*(=|at|to)\s*n\b(?!\s*-)/i.test(line) && !lower.includes("n - 1")) {
      warnings.push({
        clauseIndex: idx,
        snippet: line,
        warningMessage: "Possible off-by-one upper array bound (right = n)",
        whyItCanFail:
          "0-based arrays only have valid indices from 0 to n - 1. Reading arr[n] accesses out-of-bounds memory.",
        suggestedFix: line.replace(/\bn\b/i, "n - 1"),
        certainty: "suggestion",
      });
    }

    // 4. Infinite recursion warning if recursive function lacks base case mention
    const hasBaseCase =
      /\bbase\s*case\b|\bstop\s+(if|when|at)\b|\bif\s*\(?\s*(n|node|curr|i)\b|\b<=\s*1\b|\b==\s*0\b|\b==\s*null\b/i.test(
        logicText
      );
    if ((lower.includes("call itself") || lower.includes("recurs")) && !hasBaseCase) {
      warnings.push({
        clauseIndex: idx,
        snippet: line,
        warningMessage: "Recursive logic may lack an explicit base case",
        whyItCanFail:
          "Without a terminating condition (such as n <= 1 or node == null), recursion recurses indefinitely until a stack overflow occurs.",
        suggestedFix: `First handle the base case (stop when input reaches minimum size), then ${line}`,
        certainty: "suggestion",
      });
    }
  });

  return warnings;
}

function applyBugWarningsToClauses(
  clauses: ExtractedClause[],
  logicText: string
): ExtractedClause[] {
  const bugs = detectGentleBugsInLogic(logicText);
  if (bugs.length === 0) return clauses;

  return clauses.map((clause, idx) => {
    const match =
      bugs.find((b) =>
        clause.englishSpan.toLowerCase().includes(b.snippet.toLowerCase().slice(0, 24))
      ) || (idx === 0 && bugs[0] ? bugs[0] : undefined);
    if (!match) return clause;
    return {
      ...clause,
      status: "warning",
      warningMessage: match.warningMessage,
      whyItCanFail: match.whyItCanFail,
      suggestedFix: match.suggestedFix,
      fixCertainty: match.certainty,
    };
  });
}

// Local offline fallback templates for recognized common DSA problems
export function matchLocalDsaFallback(params: {
  problemStatement: string;
  logicText: string;
  analyzedText: string;
  analyzedScope: "full" | "selection";
}): LogicMorphAnalysis {
  const combined = `${params.problemStatement}\n${params.analyzedText}`.toLowerCase();

  // Check if clearly Binary Search
  if (
    combined.includes("binary search") ||
    (combined.includes("mid") && combined.includes("sorted") && combined.includes("target"))
  ) {
    const base = structuredClone(PRESET_PROBLEMS[0].analysis);
    base.source = "local-template";
    base.analyzedScope = params.analyzedScope;
    base.analyzedText = params.analyzedText;
    base.extractedClauses = applyBugWarningsToClauses(base.extractedClauses, params.analyzedText);
    return base;
  }

  // Check if clearly Two Sum II / Two Pointers
  if (
    combined.includes("two sum") ||
    (combined.includes("two pointer") && combined.includes("sum"))
  ) {
    const base = structuredClone(PRESET_PROBLEMS[1].analysis);
    base.source = "local-template";
    base.analyzedScope = params.analyzedScope;
    base.analyzedText = params.analyzedText;
    base.extractedClauses = applyBugWarningsToClauses(base.extractedClauses, params.analyzedText);
    return base;
  }

  // Sliding Window local template
  if (combined.includes("sliding window") || (combined.includes("window") && combined.includes("subarray"))) {
    return buildSlidingWindowFallback(params.analyzedText, params.analyzedScope);
  }

  // Linked List local template
  if (combined.includes("linked list") || (combined.includes("prev") && combined.includes("next"))) {
    return buildLinkedListFallback(params.analyzedText, params.analyzedScope);
  }

  // Recursion / Fibonacci / Factorial local template
  if (combined.includes("recursion") || combined.includes("factorial") || combined.includes("fibonacci")) {
    return buildRecursionFallback(params.analyzedText, params.analyzedScope);
  }

  // Dynamic Programming local template
  if (combined.includes("dynamic programming") || combined.includes("dp[") || combined.includes("climbing stairs")) {
    return buildDpFallback(params.analyzedText, params.analyzedScope);
  }

  // Unknown algorithm when offline -> explicitly honest unverified-offline state
  return buildUnverifiedOfflineResult(params);
}

function buildSlidingWindowFallback(
  analyzedText: string,
  analyzedScope: "full" | "selection"
): LogicMorphAnalysis {
  const fullCode: Record<ProgrammingLanguage, string[]> = {
    c: [
      "int maxSumSubarray(int arr[], int n, int k) {",
      "    int windowSum = 0, maxSum = 0;",
      "    for (int i = 0; i < k; i++) windowSum += arr[i];",
      "    maxSum = windowSum;",
      "    for (int right = k; right < n; right++) {",
      "        windowSum += arr[right] - arr[right - k];",
      "        if (windowSum > maxSum) maxSum = windowSum;",
      "    }",
      "    return maxSum;",
      "}",
    ],
    python: [
      "def max_sum_subarray(arr: list[int], k: int) -> int:",
      "    window_sum = sum(arr[:k])",
      "    max_sum = window_sum",
      "    for right in range(k, len(arr)):",
      "        window_sum += arr[right] - arr[right - k]",
      "        max_sum = max(max_sum, window_sum)",
      "    return max_sum",
    ],
    cpp: [
      "int maxSumSubarray(const vector<int>& arr, int k) {",
      "    int windowSum = 0;",
      "    for (int i = 0; i < k; i++) windowSum += arr[i];",
      "    int maxSum = windowSum;",
      "    for (int right = k; right < static_cast<int>(arr.size()); right++) {",
      "        windowSum += arr[right] - arr[right - k];",
      "        maxSum = max(maxSum, windowSum);",
      "    }",
      "    return maxSum;",
      "}",
    ],
    java: [
      "public int maxSumSubarray(int[] arr, int k) {",
      "    int windowSum = 0;",
      "    for (int i = 0; i < k; i++) windowSum += arr[i];",
      "    int maxSum = windowSum;",
      "    for (int right = k; right < arr.length; right++) {",
      "        windowSum += arr[right] - arr[right - k];",
      "        maxSum = Math.max(maxSum, windowSum);",
      "    }",
      "    return maxSum;",
      "}",
    ],
  };

  const clauses: ExtractedClause[] = [
    {
      clauseId: "sw-1",
      englishSpan: "Compute the initial sum of the first k elements as the starting window.",
      logicRole: "initialization",
      status: "valid",
      codeLineIds: ["L2", "L3"],
      codeLines: {
        c: fullCode.c.slice(1, 4),
        python: fullCode.python.slice(1, 3),
        cpp: fullCode.cpp.slice(1, 4),
        java: fullCode.java.slice(1, 4),
      },
      syntaxTip: {
        c: "Accumulate the first k indices before entering the sliding loop.",
        python: "sum(arr[:k]) computes the initial window sum cleanly in Python.",
        cpp: "Initialize maxSum = windowSum immediately so negative subarrays are handled accurately.",
        java: "Keep windowSum in an int (or long if sums can exceed 2^31 - 1).",
      },
      practiceBlank: {
        c: {
          prompt: "for (int i = 0; i < ____; i++) windowSum += arr[i];",
          tokens: ["k", "n", "k - 1", "1"],
          correctToken: "k",
          hint: "Sum exactly the initial window width.",
          explanation: "Looping i < k sums indices 0..k-1.",
        },
        python: {
          prompt: "window_sum = sum(arr[:____])",
          tokens: ["k", "n", "k+1", "1"],
          correctToken: "k",
          hint: "Slice the first k elements.",
          explanation: "arr[:k] selects the opening k-element window.",
        },
        cpp: {
          prompt: "int maxSum = ____;",
          tokens: ["windowSum", "0", "INT_MIN", "k"],
          correctToken: "windowSum",
          hint: "The first valid window sum is already computed.",
          explanation: "Starting maxSum at windowSum handles all-negative arrays safely.",
        },
        java: {
          prompt: "for (int i = 0; i < ____; i++) windowSum += arr[i];",
          tokens: ["k", "arr.length", "k-1", "0"],
          correctToken: "k",
          hint: "Build the first window of size k.",
          explanation: "Summing the first k elements primes the sliding window.",
        },
      },
      mathXRay: {
        formulaTitle: "Initial Window: W[0..k-1]",
        whyItWorks:
          "Computing the first k-element window once takes O(k) time and establishes our baseline sum.",
        substitutionSteps: ["arr = [2, 1, 5, 1, 3, 2], k = 3", "windowSum = 2 + 1 + 5 = 8", "maxSum = 8"],
        boundaryIntuition: "Guard against k > n before slicing in production code.",
        intuition: "Window width stays fixed at k throughout the pass.",
      },
      visualState: {
        mode: "sliding_window",
        array: [2, 1, 5, 1, 3, 2],
        windowRange: [0, 2],
        pointers: { left: 0, right: 2 },
        variables: { k: 3, windowSum: 8, maxSum: 8 },
        callOrStateNote: "Initial window [0..2] holds [2, 1, 5] with sum 8.",
      },
    },
    {
      clauseId: "sw-2",
      englishSpan: "Slide the window right: add arr[right] and subtract the outgoing arr[right - k].",
      logicRole: "update",
      status: "valid",
      codeLineIds: ["L5", "L6"],
      codeLines: {
        c: fullCode.c.slice(4, 7),
        python: fullCode.python.slice(3, 6),
        cpp: fullCode.cpp.slice(4, 7),
        java: fullCode.java.slice(4, 7),
      },
      syntaxTip: {
        c: "Incremental update O(1) avoids re-summing k elements per shift.",
        python: "arr[right] - arr[right - k] updates the sum in constant time.",
        cpp: "Update windowSum first before checking std::max(maxSum, windowSum).",
        java: "Math.max returns the larger of the previous max and updated window sum.",
      },
      practiceBlank: {
        c: {
          prompt: "windowSum += arr[right] - arr[right - ____];",
          tokens: ["k", "1", "left", "n"],
          correctToken: "k",
          hint: "Drop the element that just fell behind the window of length k.",
          explanation: "right - k is the exact outgoing index on the left edge.",
        },
        python: {
          prompt: "window_sum += arr[right] - arr[right - ____]",
          tokens: ["k", "1", "0", "len(arr)"],
          correctToken: "k",
          hint: "Subtract the outgoing item k steps behind right.",
          explanation: "Keeps window length fixed at k.",
        },
        cpp: {
          prompt: "windowSum += arr[right] ____ arr[right - k];",
          tokens: ["-", "+", "*", "/"],
          correctToken: "-",
          hint: "Remove the element exiting the left side of the window.",
          explanation: "Subtracting arr[right - k] keeps only the latest k elements.",
        },
        java: {
          prompt: "maxSum = Math.____(maxSum, windowSum);",
          tokens: ["max", "min", "abs", "sum"],
          correctToken: "max",
          hint: "Track the largest window sum seen so far.",
          explanation: "Math.max preserves the running maximum across slides.",
        },
      },
      mathXRay: {
        formulaTitle: "Incremental Slide: sum' = sum + arr[right] - arr[right - k]",
        whyItWorks:
          "Adjacent windows share k - 1 overlapping elements. Updating only the entering and leaving edges drops complexity from O(n·k) to O(n).",
        substitutionSteps: [
          "Slide from [0..2] to [1..3] (right = 3): 8 + arr[3](1) - arr[0](2) = 7",
          "Slide to [2..4] (right = 4): 7 + arr[4](3) - arr[1](1) = 9 (New Max!)",
          "Final maxSum = 9",
        ],
        boundaryIntuition: "right starts at k so right - k = 0 is always a valid index.",
        intuition: "Each array element enters once and leaves once.",
      },
      visualState: {
        mode: "sliding_window",
        array: [2, 1, 5, 1, 3, 2],
        windowRange: [2, 4],
        pointers: { left: 2, right: 4 },
        variables: { k: 3, windowSum: 9, maxSum: 9 },
        callOrStateNote: "Window [2..4] = [5, 1, 3] achieves maxSum = 9.",
      },
    },
  ];

  return {
    problemTitle: "Maximum Sum Subarray of Size K",
    problemCategory: "Sliding Window",
    algorithmName: "Fixed-Size Sliding Window",
    detectedLanguage: "Plain English",
    problemSummary: "Maintain a rolling sum across a fixed k-length window in O(n) time.",
    exampleInput: "arr = [2, 1, 5, 1, 3, 2], k = 3",
    expectedOutput: "9",
    extractedClauses: applyBugWarningsToClauses(clauses, analyzedText),
    fullCode,
    edgeCases: ["If k > n, return invalid/0", "Handle negative integers by initializing maxSum = windowSum"],
    complexity: { time: "O(n)", space: "O(1)", explanation: "Single linear pass with two rolling accumulators." },
    source: "local-template",
    analyzedScope,
    analyzedText,
  };
}

function buildLinkedListFallback(
  analyzedText: string,
  analyzedScope: "full" | "selection"
): LogicMorphAnalysis {
  const fullCode: Record<ProgrammingLanguage, string[]> = {
    c: [
      "struct Node* reverseList(struct Node* head) {",
      "    struct Node *prev = NULL, *curr = head;",
      "    while (curr != NULL) {",
      "        struct Node* nextNode = curr->next;",
      "        curr->next = prev;",
      "        prev = curr;",
      "        curr = nextNode;",
      "    }",
      "    return prev;",
      "}",
    ],
    python: [
      "def reverse_list(head):",
      "    prev, curr = None, head",
      "    while curr is not None:",
      "        next_node = curr.next",
      "        curr.next = prev",
      "        prev = curr",
      "        curr = next_node",
      "    return prev",
    ],
    cpp: [
      "ListNode* reverseList(ListNode* head) {",
      "    ListNode *prev = nullptr, *curr = head;",
      "    while (curr != nullptr) {",
      "        ListNode* nextNode = curr->next;",
      "        curr->next = prev;",
      "        prev = curr;",
      "        curr = nextNode;",
      "    }",
      "    return prev;",
      "}",
    ],
    java: [
      "public ListNode reverseList(ListNode head) {",
      "    ListNode prev = null, curr = head;",
      "    while (curr != null) {",
      "        ListNode nextNode = curr.next;",
      "        curr.next = prev;",
      "        prev = curr;",
      "        curr = nextNode;",
      "    }",
      "    return prev;",
      "}",
    ],
  };

  const clauses: ExtractedClause[] = [
    {
      clauseId: "ll-1",
      englishSpan: "Initialize prev = null and curr = head before traversing the list.",
      logicRole: "initialization",
      status: "valid",
      codeLineIds: ["L2"],
      codeLines: {
        c: [fullCode.c[1]],
        python: [fullCode.python[1]],
        cpp: [fullCode.cpp[1]],
        java: [fullCode.java[1]],
      },
      syntaxTip: {
        c: "Use NULL (or nullptr in C23) to represent the terminated tail pointer.",
        python: "Python uses None to indicate an empty node reference.",
        cpp: "Prefer nullptr over NULL in modern C++ for type safety.",
        java: "Java object references default/compare against null.",
      },
      mathXRay: {
        formulaTitle: "Three-Pointer In-Place Reversal Setup",
        whyItWorks:
          "prev anchors the reversed prefix (starting empty = null), while curr walks the unreversed suffix starting at head.",
        substitutionSteps: ["List: 10 → 20 → 30 → null", "prev = null", "curr = Node(10)"],
        boundaryIntuition: "If head is null, the while loop does not run and returns null.",
        intuition: "Reversing pointers in-place requires O(1) memory.",
      },
      visualState: {
        mode: "linked_list",
        nodes: [
          { id: "n1", label: "10", next: "n2", active: true },
          { id: "n2", label: "20", next: "n3" },
          { id: "n3", label: "30", next: null },
        ],
        pointers: { prev: "null", curr: "10" },
        variables: { prev: "null", curr: "10" },
        callOrStateNote: "prev = null, curr starts at head (10).",
      },
    },
    {
      clauseId: "ll-2",
      englishSpan: "Save curr.next, point curr.next to prev, then advance prev = curr and curr = nextNode.",
      logicRole: "update",
      status: "valid",
      codeLineIds: ["L4", "L5", "L6", "L7"],
      codeLines: {
        c: fullCode.c.slice(3, 7),
        python: fullCode.python.slice(3, 7),
        cpp: fullCode.cpp.slice(3, 7),
        java: fullCode.java.slice(3, 7),
      },
      syntaxTip: {
        c: "Always save curr->next BEFORE overwriting curr->next = prev or you lose the rest of the list!",
        python: "Saving next_node preserves the forward reference prior to reversal.",
        cpp: "Use -> to dereference pointer fields in C++.",
        java: "Use dot notation curr.next for Java object references.",
      },
      mathXRay: {
        formulaTitle: "Safe Pointer Flip: save next → flip link → shift both",
        whyItWorks:
          "Storing nextNode first prevents breaking the chain when curr.next is redirected backward to prev.",
        substitutionSteps: [
          "nextNode = Node(20)",
          "10.next = null (prev)",
          "prev = Node(10), curr = Node(20)",
        ],
        boundaryIntuition: "When curr reaches null, prev points to the new head (30).",
        intuition: "Each node link is reassigned exactly once.",
      },
      visualState: {
        mode: "linked_list",
        nodes: [
          { id: "n1", label: "10", next: null, visited: true },
          { id: "n2", label: "20", next: "n1", visited: true },
          { id: "n3", label: "30", next: "n2", active: true },
        ],
        pointers: { prev: "30", curr: "null" },
        variables: { newHead: "30 → 20 → 10 → null" },
        callOrStateNote: "All links reversed: 30 → 20 → 10 → null. Returns prev (30).",
      },
    },
  ];

  return {
    problemTitle: "Reverse Linked List",
    problemCategory: "Linked Lists",
    algorithmName: "Iterative 3-Pointer Reversal",
    detectedLanguage: "Plain English",
    problemSummary: "Reverse singly linked list pointers in-place using prev, curr, and nextNode.",
    exampleInput: "head = [10, 20, 30]",
    expectedOutput: "[30, 20, 10]",
    extractedClauses: applyBugWarningsToClauses(clauses, analyzedText),
    fullCode,
    edgeCases: ["Empty list (head == null)", "Single-node list"],
    complexity: { time: "O(n)", space: "O(1)", explanation: "Single traversal updating links in place." },
    source: "local-template",
    analyzedScope,
    analyzedText,
  };
}

function buildRecursionFallback(
  analyzedText: string,
  analyzedScope: "full" | "selection"
): LogicMorphAnalysis {
  const fullCode: Record<ProgrammingLanguage, string[]> = {
    c: [
      "long long factorial(int n) {",
      "    if (n <= 1) return 1;",
      "    return n * factorial(n - 1);",
      "}",
    ],
    python: [
      "def factorial(n: int) -> int:",
      "    if n <= 1:",
      "        return 1",
      "    return n * factorial(n - 1)",
    ],
    cpp: [
      "long long factorial(int n) {",
      "    if (n <= 1) return 1;",
      "    return n * factorial(n - 1);",
      "}",
    ],
    java: [
      "public long factorial(int n) {",
      "    if (n <= 1) return 1;",
      "    return n * factorial(n - 1);",
      "}",
    ],
  };

  const clauses: ExtractedClause[] = [
    {
      clauseId: "rec-1",
      englishSpan: "Base case: if n <= 1 return 1 to stop recursion cleanly.",
      logicRole: "termination",
      status: "valid",
      codeLineIds: ["L2"],
      codeLines: {
        c: [fullCode.c[1]],
        python: fullCode.python.slice(1, 3),
        cpp: [fullCode.cpp[1]],
        java: [fullCode.java[1]],
      },
      syntaxTip: {
        c: "Use long long to avoid 32-bit overflow past 12!.",
        python: "Python integers have arbitrary precision, avoiding factorial overflow.",
        cpp: "A terminating base case must execute before the recursive call.",
        java: "long holds up to 20! safely in 64-bit signed arithmetic.",
      },
      mathXRay: {
        formulaTitle: "Base Case Grounding: f(1) = f(0) = 1",
        whyItWorks: "Every recursive chain must reach a non-recursive answer so the call stack can unwind.",
        substitutionSteps: ["Call stack descends: f(4) → f(3) → f(2) → f(1)", "f(1) hits base case and returns 1"],
        boundaryIntuition: "Checking n <= 1 also prevents infinite recursion if n = 0 is passed.",
        intuition: "Each active frame occupies O(1) stack memory until unwinding.",
      },
      visualState: {
        mode: "recursion",
        stackFrames: [
          { fn: "factorial", params: "n = 4", state: "waiting" },
          { fn: "factorial", params: "n = 3", state: "waiting" },
          { fn: "factorial", params: "n = 2", state: "waiting" },
          { fn: "factorial", params: "n = 1", state: "base", returnVal: "1" },
        ],
        variables: { n: 1, baseReturn: 1 },
        callOrStateNote: "Base case reached at n = 1; stack begins unwinding.",
      },
    },
    {
      clauseId: "rec-2",
      englishSpan: "Recursive step: return n * factorial(n - 1) while unwinding stack frames.",
      logicRole: "return",
      status: "valid",
      codeLineIds: ["L3"],
      codeLines: {
        c: [fullCode.c[2]],
        python: [fullCode.python[3]],
        cpp: [fullCode.cpp[2]],
        java: [fullCode.java[2]],
      },
      syntaxTip: {
        c: "The pending multiplication happens after the recursive child frame returns.",
        python: "Python caps recursion depth around ~1000 frames by default.",
        cpp: "Reducing n by 1 each call guarantees progress toward the base case.",
        java: "Each stack frame keeps its own isolated local copy of parameter n.",
      },
      mathXRay: {
        formulaTitle: "Recurrence Relation: n! = n × (n - 1)!",
        whyItWorks: "Child frames return (n - 1)! up the stack so parent frames multiply by n.",
        substitutionSteps: ["f(2) = 2 * 1 = 2", "f(3) = 3 * 2 = 6", "f(4) = 4 * 6 = 24"],
        boundaryIntuition: "Stack depth equals n frames.",
        intuition: "Time O(n), Space O(n) on the call stack.",
      },
      visualState: {
        mode: "recursion",
        stackFrames: [
          { fn: "factorial", params: "n = 4", state: "returning", returnVal: "24" },
          { fn: "factorial", params: "n = 3", state: "returning", returnVal: "6" },
          { fn: "factorial", params: "n = 2", state: "returning", returnVal: "2" },
        ],
        variables: { n: 4, finalResult: 24 },
        callOrStateNote: "Unwinding completes: 4 × 3 × 2 × 1 = 24.",
      },
    },
  ];

  return {
    problemTitle: "Recursive Factorial",
    problemCategory: "Recursion",
    algorithmName: "Linear Call-Stack Recursion",
    detectedLanguage: "Plain English",
    problemSummary: "Decompose n! into n × (n - 1)! down to base case n <= 1.",
    exampleInput: "n = 4",
    expectedOutput: "24",
    extractedClauses: applyBugWarningsToClauses(clauses, analyzedText),
    fullCode,
    edgeCases: ["n = 0 returns 1", "Large n risks stack overflow or 64-bit integer overflow"],
    complexity: { time: "O(n)", space: "O(n)", explanation: "n nested stack frames active at deepest call." },
    source: "local-template",
    analyzedScope,
    analyzedText,
  };
}

function buildDpFallback(
  analyzedText: string,
  analyzedScope: "full" | "selection"
): LogicMorphAnalysis {
  const fullCode: Record<ProgrammingLanguage, string[]> = {
    c: [
      "int climbStairs(int n) {",
      "    if (n <= 2) return n;",
      "    int dp[n + 1];",
      "    dp[1] = 1; dp[2] = 2;",
      "    for (int i = 3; i <= n; i++) dp[i] = dp[i - 1] + dp[i - 2];",
      "    return dp[n];",
      "}",
    ],
    python: [
      "def climb_stairs(n: int) -> int:",
      "    if n <= 2: return n",
      "    dp = [0] * (n + 1)",
      "    dp[1], dp[2] = 1, 2",
      "    for i in range(3, n + 1): dp[i] = dp[i - 1] + dp[i - 2]",
      "    return dp[n]",
    ],
    cpp: [
      "int climbStairs(int n) {",
      "    if (n <= 2) return n;",
      "    vector<int> dp(n + 1);",
      "    dp[1] = 1; dp[2] = 2;",
      "    for (int i = 3; i <= n; i++) dp[i] = dp[i - 1] + dp[i - 2];",
      "    return dp[n];",
      "}",
    ],
    java: [
      "public int climbStairs(int n) {",
      "    if (n <= 2) return n;",
      "    int[] dp = new int[n + 1];",
      "    dp[1] = 1; dp[2] = 2;",
      "    for (int i = 3; i <= n; i++) dp[i] = dp[i - 1] + dp[i - 2];",
      "    return dp[n];",
      "}",
    ],
  };

  const clauses: ExtractedClause[] = [
    {
      clauseId: "dp-1",
      englishSpan: "Seed base DP states dp[1] = 1 and dp[2] = 2.",
      logicRole: "initialization",
      status: "valid",
      codeLineIds: ["L3", "L4"],
      codeLines: {
        c: fullCode.c.slice(2, 4),
        python: fullCode.python.slice(2, 4),
        cpp: fullCode.cpp.slice(2, 4),
        java: fullCode.java.slice(2, 4),
      },
      syntaxTip: {
        c: "Allocate size n + 1 so dp[n] is a valid 1-based index.",
        python: "[0] * (n + 1) creates an integer list initialized to zero.",
        cpp: "std::vector<int> dp(n + 1) is safer than C-style variable-length arrays.",
        java: "new int[n + 1] zero-initializes all entries automatically.",
      },
      mathXRay: {
        formulaTitle: "Base States: dp[1] = 1, dp[2] = 2",
        whyItWorks: "There is 1 way to climb 1 step ([1]) and 2 ways to climb 2 steps ([1+1], [2]).",
        substitutionSteps: ["dp[1] = 1", "dp[2] = 2"],
        boundaryIntuition: "Early return if n <= 2 avoids out-of-bounds dp[2] writes when n == 1.",
        intuition: "Tabulation stores subproblem answers bottom-up.",
      },
      visualState: {
        mode: "dp",
        dpCells: [
          { label: "dp[0]", value: 0 },
          { label: "dp[1]", value: 1, active: true },
          { label: "dp[2]", value: 2, active: true },
          { label: "dp[3]", value: "?" },
          { label: "dp[4]", value: "?" },
          { label: "dp[5]", value: "?" },
        ],
        variables: { n: 5, "dp[1]": 1, "dp[2]": 2 },
        callOrStateNote: "Base states seeded for steps 1 and 2.",
      },
    },
    {
      clauseId: "dp-2",
      englishSpan: "Transition dp[i] = dp[i - 1] + dp[i - 2] from i = 3 up to n.",
      logicRole: "update",
      status: "valid",
      codeLineIds: ["L5", "L6"],
      codeLines: {
        c: fullCode.c.slice(4, 6),
        python: fullCode.python.slice(4, 6),
        cpp: fullCode.cpp.slice(4, 6),
        java: fullCode.java.slice(4, 6),
      },
      syntaxTip: {
        c: "Bottom-up loop avoids recursive call stack overhead completely.",
        python: "range(3, n + 1) includes n as the upper bound.",
        cpp: "Space can even be compressed to two variables a, b for O(1) space.",
        java: "Returning dp[n] yields the total distinct ways to reach step n.",
      },
      mathXRay: {
        formulaTitle: "DP State Transition: dp[i] = dp[i - 1] + dp[i - 2]",
        whyItWorks: "You arrive at step i either from step i - 1 (1-step hop) or step i - 2 (2-step hop).",
        substitutionSteps: ["dp[3] = 2 + 1 = 3", "dp[4] = 3 + 2 = 5", "dp[5] = 5 + 3 = 8"],
        boundaryIntuition: "Loop runs through i == n inclusive.",
        intuition: "Eliminates exponential O(2^n) recomputation down to O(n).",
      },
      visualState: {
        mode: "dp",
        dpCells: [
          { label: "dp[0]", value: 0 },
          { label: "dp[1]", value: 1 },
          { label: "dp[2]", value: 2 },
          { label: "dp[3]", value: 3, isSource: true },
          { label: "dp[4]", value: 5, isSource: true },
          { label: "dp[5]", value: 8, active: true },
        ],
        variables: { n: 5, "dp[5]": 8 },
        callOrStateNote: "dp[5] = dp[4] + dp[3] = 5 + 3 = 8 distinct ways.",
      },
    },
  ];

  return {
    problemTitle: "Climbing Stairs (1D DP)",
    problemCategory: "Dynamic Programming",
    algorithmName: "Bottom-Up Tabulation",
    detectedLanguage: "Plain English",
    problemSummary: "Compute ways to reach step n by summing the previous two DP states.",
    exampleInput: "n = 5",
    expectedOutput: "8",
    extractedClauses: applyBugWarningsToClauses(clauses, analyzedText),
    fullCode,
    edgeCases: ["n = 1 returns 1", "Integer overflow if n > 45 with 32-bit int"],
    complexity: { time: "O(n)", space: "O(n)", explanation: "Linear DP table of size n + 1." },
    source: "local-template",
    analyzedScope,
    analyzedText,
  };
}

export function buildUnverifiedOfflineResult(params: {
  problemStatement: string;
  logicText: string;
  analyzedText: string;
  analyzedScope: "full" | "selection";
}): LogicMorphAnalysis {
  const rawClauses = params.analyzedText
    .split(/\r?\n|(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 6);

  const bugs = detectGentleBugsInLogic(params.analyzedText);

  const extractedClauses: ExtractedClause[] = (
    rawClauses.length > 0 ? rawClauses : ["Describe your algorithm steps to scan."]
  ).map((span, idx) => {
    const bug = bugs.find((b) => b.clauseIndex === idx);
    return {
      clauseId: `offline-${idx + 1}`,
      englishSpan: span,
      logicRole: idx === 0 ? "initialization" : idx === rawClauses.length - 1 ? "return" : "other",
      status: bug ? "warning" : "valid",
      warningMessage: bug?.warningMessage,
      whyItCanFail: bug?.whyItCanFail,
      suggestedFix: bug?.suggestedFix,
      fixCertainty: bug?.certainty,
      codeLineIds: [`L${idx + 2}`],
      codeLines: {
        c: [`    // Step ${idx + 1}: ${span.slice(0, 56)}`],
        python: [`    # Step ${idx + 1}: ${span.slice(0, 56)}`],
        cpp: [`    // Step ${idx + 1}: ${span.slice(0, 56)}`],
        java: [`    // Step ${idx + 1}: ${span.slice(0, 56)}`],
      },
      syntaxTip: {
        c: "Online Gemini translation is required to synthesize verified C code for custom arbitrary algorithms.",
        python: "Online Gemini translation is required to synthesize verified Python code for custom arbitrary algorithms.",
        cpp: "Online Gemini translation is required to synthesize verified C++ code for custom arbitrary algorithms.",
        java: "Online Gemini translation is required to synthesize verified Java code for custom arbitrary algorithms.",
      },
      mathXRay: {
        formulaTitle: "Offline Structural Breakdown",
        whyItWorks:
          "Your clause was parsed locally without fabricating unverified multi-language code. Click 'Retry Gemini' once online to synthesize full translated code, practice blanks, and visual states.",
        substitutionSteps: [
          `Parsed Clause ${idx + 1}: "${span}"`,
          bug ? `Flagged Potential Issue: ${bug.warningMessage}` : "No local syntax-logic warnings flagged",
        ],
        boundaryIntuition: "Verify loop exit conditions and empty/single-element inputs before translating.",
        intuition: "Offline mode preserves your logic cleanly without inventing fake translations.",
      },
      visualState: {
        mode: "variables",
        variables: {
          mode: "Offline Clause Parser",
          step: `${idx + 1} / ${Math.max(1, rawClauses.length)}`,
          status: bug ? "Warning Flagged" : "Parsed",
        },
        callOrStateNote:
          "Online Gemini analysis is required for full multi-language synthesis of custom algorithms. Click Retry Gemini when available.",
      },
    };
  });

  const makeSkeleton = (commentPrefix: string): string[] => [
    `${commentPrefix} Online Gemini analysis required for verified full code generation.`,
    ...extractedClauses.map((c, i) => `    ${commentPrefix} Clause ${i + 1}: ${c.englishSpan}`),
  ];

  return {
    problemTitle: params.problemStatement.trim().split("\n")[0]?.slice(0, 60) || "Custom DSA Logic",
    problemCategory: "Custom Algorithm (Offline Mode)",
    algorithmName: "Awaiting Online Gemini Synthesis",
    detectedLanguage: "Plain English",
    problemSummary:
      "Local clause scan completed. Connect to Gemini (click Retry Gemini) to generate verified 4-language code and live traces for arbitrary custom algorithms.",
    exampleInput: "Custom input",
    expectedOutput: "Pending online synthesis",
    extractedClauses,
    fullCode: {
      c: makeSkeleton("//"),
      python: makeSkeleton("#"),
      cpp: makeSkeleton("//"),
      java: makeSkeleton("//"),
    },
    edgeCases: [
      "Empty input or null boundary",
      "Single-element or minimum input size",
      "Click 'Retry Gemini' when API quota/network recovers for full synthesis",
    ],
    complexity: {
      time: "Pending Gemini",
      space: "Pending Gemini",
      explanation: "Complexity is computed once Gemini translates the full custom algorithm.",
    },
    source: "unverified-offline",
    analyzedScope: params.analyzedScope,
    analyzedText: params.analyzedText,
  };
}
