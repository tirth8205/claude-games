# claude-games Runner demo (deterministic with --demo)
# Run: vhs assets/runner.tape

Output assets/runner.gif

Set Theme "GitHub Dark"
Set FontSize 20
Set Width 1200
Set Height 800
Set Padding 40
Set Framerate 15
Set TypingSpeed 80ms

# Launch in demo mode — obstacles spawn every 25 ticks (~1.25s)
Type "node dist/cli.js --demo"
Enter
Sleep 3s
Enter
Sleep 2s

# Start running
Space
Sleep 1s

# First obstacle arrives ~1.25s — jump
Space
Sleep 1.5s

# Second obstacle — jump
Space
Sleep 1.5s

# Third — jump
Space
Sleep 1.5s

# Fourth — duck (might be aerial)
Down
Sleep 1.5s

# Fifth — jump
Space
Sleep 1.5s

# Sixth — jump
Space
Sleep 1.5s

# Seventh — duck
Down
Sleep 1.5s

# Keep going
Space
Sleep 1.5s
Space
Sleep 1.5s

# Show pause
Type "p"
Sleep 3s

# Resume
Type "p"
Sleep 1s

Space
Sleep 1.5s
Space
Sleep 1.5s

# Quit
Sleep 1s
Type "q"
Sleep 2s
Type "q"
Sleep 2s
