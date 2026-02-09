
import { BookData } from '../../types';

export const C_PROGRAMMING_BOOK: BookData = {
  id: 'c-programming-college',
  title: "C Systems Programming",
  subtitle: "A 12-Lecture Intensive for College Students",
  author: "Neural Academy",
  version: "v1.0.0",
  category: "Platform",
  pages: [
    {
      title: "1. Foundations & Environment",
      content: String.raw`
# 🖥️ Lecture 1: Foundations

C is a low-level, procedural language that serves as the foundation for modern operating systems like Linux and Windows.

### The Compilation Model
Unlike interpreted languages (Python/JS), C must be compiled into machine-readable binary.
1. **Preprocessing**: Handles #include and #define.
2. **Compilation**: Translates C to Assembly.
3. **Assembly**: Translates Assembly to Machine Code (Object files).
4. **Linking**: Combines object files into an Executable.

### Example: Hello World
${'```'}c
#include <stdio.h>

int main() {
    printf("Hello, Neural Prism!\\n");
    return 0;
}
${'```'}

### Homework
- Install ${"`"}gcc${"`"} or use the **Builder Studio** in this platform.
- Modify the example to print your name and student ID.
      `
    },
    {
      title: "2. Data Types & Variables",
      content: String.raw`
# 📦 Lecture 2: Data Types

C is statically typed. You must declare the "size" of a variable before using it.

### Core Types
- ${"`"}int${"`"}: Integers (typically 4 bytes).
- ${"`"}float${"`"}: Single-precision floating point.
- ${"`"}char${"`"}: A single byte (stores ASCII characters).
- ${"`"}double${"`"}: Double-precision (8 bytes).

### Example: Memory Sizes
${'```'}c
#include <stdio.h>

int main() {
    int a = 10;
    printf("Size of int: %zu bytes\\n", sizeof(a));
    return 0;
}
${'```'}

### Homework
Write a program that calculates the area of a circle using a ${"`"}double${"`"} for radius and a constant for PI.
      `
    },
    {
      title: "3. Operators & Logic",
      content: String.raw`
# 🔢 Lecture 3: Operators

C supports arithmetic, relational, and logical operators.

### Arithmetic
${"`"}+${"`"}, ${"`"}-${"`"}, ${"`"}*${"`"}, ${"`"}/${"`"}, ${"`"}%${"`"} (Modulus).

### Logical
- ${"`"}&&${"`"}: AND
- ${"`"}||${"`"}: OR
- ${"`"}!${"`"}: NOT

### Example: Even or Odd
${'```'}c
#include <stdio.h>

int main() {
    int num = 7;
    if (num % 2 == 0) {
        printf("Even\\n");
    } else {
        printf("Odd\\n");
    }
    return 0;
}
${'```'}

### Homework
Create a simple calculator that takes two numbers and an operator (+, -, *, /) as input and outputs the result.
      `
    },
    {
      title: "4. Control Flow (Conditionals)",
      content: String.raw`
# 🚦 Lecture 4: Control Flow

Decision making in C uses ${"`"}if${"`"}, ${"`"}else if${"`"}, ${"`"}else${"`"}, and ${"`"}switch${"`"}.

### Example: Grade Evaluation
${'```'}c
#include <stdio.h>

int main() {
    char grade = 'B';
    switch(grade) {
        case 'A': printf("Excellent!\\n"); break;
        case 'B': printf("Well done\\n"); break;
        default: printf("Keep trying\\n");
    }
    return 0;
}
${'```'}

### Homework
Write a program to find the largest of three numbers provided by the user.
      `
    },
    {
      title: "5. Iteration & Loops",
      content: String.raw`
# 🔄 Lecture 5: Iteration

Loops repeat code until a condition is met.

### Loop Types
- ${"`"}for${"`"}: Best when the number of iterations is known.
- ${"`"}while${"`"}: Best for event-driven logic.
- ${"`"}do-while${"`"}: Guarantees at least one execution.

### Example: Factorial
${'```'}c
#include <stdio.h>

int main() {
    int n = 5, fact = 1;
    for(int i = 1; i <= n; i++) {
        fact *= i;
    }
    printf("Factorial: %d", fact);
    return 0;
}
${'```'}

### Homework
Generate the first 10 numbers of the Fibonacci sequence using a ${"`"}while${"`"} loop.
      `
    },
    {
      title: "6. Functions & Scope",
      content: String.raw`
# 🛠️ Lecture 6: Modular Code

Functions allow you to reuse logic and manage complexity.

### Syntax
${"`"}return_type name(parameters) { body }${"`"}

### Scope
Variables declared inside a function are local to that function.

### Example: Power Function
${'```'}c
int power(int base, int exp) {
    int res = 1;
    while(exp--) res *= base;
    return res;
}
${'```'}

### Homework
Write a function ${"`"}isPrime(int n)${"`"} that returns 1 if a number is prime and 0 otherwise.
      `
    },
    {
      title: "7. Arrays & Strings",
      content: String.raw`
# 📊 Lecture 7: Collections

An array is a contiguous block of memory holding multiple items of the same type.

### Strings
In C, a string is simply a ${"`"}char${"`"} array terminated by a null character (${"`"}'\\0'${"`"}).

### Example: Array Average
${'```'}c
#include <stdio.h>

int main() {
    int marks[5] = {80, 90, 70, 85, 95};
    int sum = 0;
    for(int i=0; i<5; i++) sum += marks[i];
    printf("Avg: %d", sum/5);
    return 0;
}
${'```'}

### Homework
Write a program that reverses a string without using library functions like ${"`"}strrev${"`"}.
      `
    },
    {
      title: "8. Pointers: The Neural Core",
      content: String.raw`
# 📍 Lecture 8: Pointers

Pointers are variables that store the memory address of another variable. This is C's "Superpower."

### Key Symbols
- ${"`"}&${"`"}: Address-of operator.
- ${"`"}*${"`"}: Dereference operator.

### Example: Swapping
${'```'}c
void swap(int *a, int *b) {
    int temp = *a;
    *a = *b;
    *b = temp;
}
${'```'}

### Homework
Explain the difference between a pointer to an integer and an array name in terms of memory.
      `
    },
    {
      title: "9. Dynamic Memory Management",
      content: String.raw`
# 🧠 Lecture 9: Dynamic Memory

Memory allocated on the **Heap** persists until manually freed. Use ${"`"}stdlib.h${"`"}.

### Functions
- ${"`"}malloc(size)${"`"}: Allocate bytes.
- ${"`"}free(ptr)${"`"}: Release memory.

### Example: Dynamic Array
${'```'}c
#include <stdlib.h>

int main() {
    int *arr = (int*)malloc(5 * sizeof(int));
    if(arr == NULL) return 1; 
    arr[0] = 100;
    free(arr); 
    return 0;
}
${'```'}

### Homework
Create a program that allows the user to specify the size of an array at runtime, fills it with numbers, and then calculates the sum.
      `
    },
    {
      title: "10. Structures & Unions",
      content: String.raw`
# 🏛️ Lecture 10: User-Defined Types

Structures (${"`"}struct${"`"}) allow you to group variables of different types.

### Example: Student Record
${'```'}c
struct Student {
    char name[50];
    int age;
    float gpa;
};

struct Student s1 = {"Alice", 20, 3.8};
${'```'}

### Homework
Define a struct for a ${"`"}Rectangle${"`"} with length and width. Write a function that takes a Rectangle struct and returns its area.
      `
    },
    {
      title: "11. File Handling",
      content: String.raw`
# 💾 Lecture 11: Persistence

Reading and writing to the disk using ${"`"}FILE${"`"} pointers.

### Mode
- ${"`"}"r"${"`"}: Read
- ${"`"}"w"${"`"}: Write (overwrite)
- ${"`"}"a"${"`"}: Append

### Example: Logging
${'```'}c
#include <stdio.h>

int main() {
    FILE *f = fopen("log.txt", "w");
    if(f == NULL) return 1;
    fprintf(f, "Neural Session Started\\n");
    fclose(f);
    return 0;
}
${'```'}

### Homework
Write a program that reads a text file and counts how many words are in it.
      `
    },
    {
      title: "12. Advanced Systems Programming",
      content: String.raw`
# 🚀 Lecture 12: Advanced Topics

The final refraction: Macros, Bitwise manipulation, and Typedefs.

### Bitwise Operators
${"`"}&${"`"} (AND), ${"`"}|${"`"} (OR), ${"`"}^${"`"} (XOR), ${"`"}<<${"`"} (Shift Left).

### Example: Bit Masking
${'```'}c
#define FLAG_A 0x01

int main() {
    int status = 0;
    status |= FLAG_A; // Set bit 0
    return 0;
}
${'```'}

### Homework
Write a macro ${"`"}SQUARE(x)${"`"} that returns the square of a number. Then, write a program that uses bitwise operators to check if a number is a power of two.

**Congratulations on completing the C Refraction!**
      `
    }
  ]
};
