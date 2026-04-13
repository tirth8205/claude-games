# claude-games Snake demo
# Run: vhs assets/snake.tape

Output assets/snake.gif

Set Theme "GitHub Dark"
Set FontSize 20
Set Width 1200
Set Height 800
Set Padding 40
Set Framerate 15
Set TypingSpeed 80ms

# Launch and go to Snake
Type "node dist/cli.js"
Enter
Sleep 3s

# Select Snake
Type "2"
Sleep 2s

# Play — move around the grid slowly
Right
Sleep 700ms
Right
Sleep 700ms
Right
Sleep 700ms
Right
Sleep 700ms
Down
Sleep 700ms
Down
Sleep 700ms
Down
Sleep 700ms
Left
Sleep 700ms
Left
Sleep 700ms
Left
Sleep 700ms
Up
Sleep 700ms
Up
Sleep 700ms
Right
Sleep 700ms
Right
Sleep 700ms
Down
Sleep 700ms
Down
Sleep 700ms
Left
Sleep 700ms
Left
Sleep 700ms
Up
Sleep 700ms
Right
Sleep 700ms
Right
Sleep 700ms
Down
Sleep 700ms

# Show pause
Type "p"
Sleep 3s

# Resume
Type "p"
Sleep 1s

Right
Sleep 700ms
Down
Sleep 700ms
Down
Sleep 700ms
Left
Sleep 700ms

# Quit
Type "q"
Sleep 2s
Type "q"
Sleep 2s
