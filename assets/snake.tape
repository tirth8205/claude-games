# claude-games Snake demo (deterministic with --demo)
# Run: vhs assets/snake.tape

Output assets/snake.gif

Set Theme "GitHub Dark"
Set FontSize 20
Set Width 1200
Set Height 800
Set Padding 40
Set Framerate 15
Set TypingSpeed 80ms

# Launch in demo mode — food spawns near the snake head
Type "node dist/cli.js --demo"
Enter
Sleep 3s

# Select Snake
Type "2"
Sleep 2s

# Food 1 is 3 right from head — go right to eat it
Right
Sleep 600ms
Right
Sleep 600ms
Right
Sleep 600ms

# Food 2 spawns nearby — go down and right
Sleep 800ms
Down
Sleep 600ms
Down
Sleep 600ms
Right
Sleep 600ms
Right
Sleep 600ms

# Food 3 — down and left
Sleep 800ms
Down
Sleep 600ms
Down
Sleep 600ms
Left
Sleep 600ms
Left
Sleep 600ms
Left
Sleep 600ms

# Keep eating
Sleep 800ms
Down
Sleep 600ms
Right
Sleep 600ms
Right
Sleep 600ms
Right
Sleep 600ms

Sleep 800ms
Up
Sleep 600ms
Up
Sleep 600ms
Right
Sleep 600ms
Right
Sleep 600ms

# Pause to show it
Type "p"
Sleep 3s

# Resume
Type "p"
Sleep 1s

Down
Sleep 600ms
Down
Sleep 600ms
Right
Sleep 600ms
Right
Sleep 600ms

# Quit
Sleep 1s
Type "q"
Sleep 2s
Type "q"
Sleep 2s
