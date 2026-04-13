# VHS tape for recording Snake gameplay
# Run: vhs assets/snake.tape

Output assets/snake.gif

Set Theme "GitHub Dark"
Set FontSize 32
Set Width 3840
Set Height 2160
Set Padding 60
Set Framerate 60

Type@100ms "node dist/cli.js"
Enter
Sleep 1.5s

# Select Snake (press 2)
Type "2"
Sleep 1s

# Start playing with right arrow
Right
Sleep 500ms
Right
Sleep 500ms
Right
Sleep 500ms
Down
Sleep 500ms
Down
Sleep 500ms
Down
Sleep 500ms
Left
Sleep 500ms
Left
Sleep 500ms
Left
Sleep 500ms
Up
Sleep 500ms
Up
Sleep 500ms
Right
Sleep 500ms
Right
Sleep 500ms
Right
Sleep 500ms
Right
Sleep 500ms
Down
Sleep 500ms
Down
Sleep 500ms
Left
Sleep 500ms
Left
Sleep 500ms

# Pause
Type "p"
Sleep 2s

# Resume
Type "p"
Sleep 1s

Right
Sleep 500ms
Right
Sleep 500ms
Down
Sleep 500ms

# Quit back to menu
Type "q"
Sleep 1s

# Quit menu
Type "q"
Sleep 1s
