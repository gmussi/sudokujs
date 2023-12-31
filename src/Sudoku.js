export const DIFFICULTY = {
	'easy':         62,
	'medium':       53,
	'hard':         44,
	'very-hard':    35,
	'insane':       26,
	'inhuman':      17,
};

export default class Sudoku {
	DIGITS = '123456789';       // Allowed sudoku.DIGITS
	ROWS = 'ABCDEFGHI';         // Row labels
	COLS = this.DIGITS;         // Column labels
	SQUARES = [];             // Square IDs

	UNITS = [];               // All units (row, column, or box)
	SQUARE_UNITS_MAP = {};    // Squares -> units map
	SQUARE_PEERS_MAP = {};    // Squares -> peers map

	MIN_GIVENS = 17;            // Minimum number of givens 
	NR_SQUARES = 81;            // Number of squares

	BLANK_CHAR = '.';
	BLANK_BOARD = '.................................................................................';

	constructor(){
		/* Initialize the Sudoku library (invoked after library load)
        */
		this.SQUARES             = this._cross(this.ROWS, this.COLS);
		this.UNITS               = this._get_all_units(this.ROWS, this.COLS);
		this.SQUARE_UNITS_MAP    = this._get_square_units_map(this.SQUARES, this.UNITS);
		this.SQUARE_PEERS_MAP    = this._get_square_peers_map(this.SQUARES, this.SQUARE_UNITS_MAP);
	}

	generate = function(difficulty){
		/* Generate a new Sudoku puzzle of a particular `difficulty`, e.g.,
        
            // Generate an "easy" sudoku puzzle
            sudoku.generate("easy");
            
        
        Difficulties are as follows, and represent the number of given squares:
        
                "easy":         61
                "medium":       52
                "hard":         43
                "very-hard":    34
                "insane":       25
                "inhuman":      17
            
            
        You may also enter a custom number of squares to be given, e.g.,
        
            // Generate a new Sudoku puzzle with 60 given squares
            sudoku.generate(60)
    
    
        `difficulty` must be a number between 17 and 81 inclusive. If it's
        outside of that range, `difficulty` will be set to the closest bound,
        e.g., 0 -> 17, and 100 -> 81.
        
        
        By default, the puzzles are unique, uless you set `unique` to false. 
        (Note: Puzzle uniqueness is not yet implemented, so puzzles are *not* 
        guaranteed to have unique solutions)
        
        TODO: Implement puzzle uniqueness
        */
        
		// If `difficulty` is a string or undefined, convert it to a number or
		// default it to "easy" if undefined.
		if(typeof difficulty === 'string' || typeof difficulty === 'undefined'){
			difficulty = DIFFICULTY[difficulty] || DIFFICULTY.easy;
		}
        
		// Force difficulty between 17 and 81 inclusive
		difficulty = this._force_range(difficulty, this.NR_SQUARES + 1, 
			this.MIN_GIVENS);
        
		// Get a set of squares and all possible candidates for each square
		let blank_board = '';
		for(let i = 0; i < this.NR_SQUARES; ++i){
			blank_board += '.';
		}
		const candidates = this._get_candidates_map(blank_board);
        
		// For each item in a shuffled list of squares
		const shuffled_squares = this._shuffle(this.SQUARES);
		for(const si in shuffled_squares){
			const square = shuffled_squares[si];
            
			// If an assignment of a random chioce causes a contradictoin, give
			// up and try again
			const rand_candidate_idx = 
                    this._rand_range(candidates[square].length);
			const rand_candidate = candidates[square][rand_candidate_idx];
			if(!this._assign(candidates, square, rand_candidate)){
				break;
			}
            
			// Make a list of all single candidates
			const single_candidates = [];
			for(const si in this.SQUARES){
				const square = this.SQUARES[si];
                
				if(candidates[square].length == 1){
					single_candidates.push(candidates[square]);
				}
			}
            
			// If we have at least difficulty, and the unique candidate count is
			// at least 8, return the puzzle!
			if(single_candidates.length >= difficulty && 
                    this._strip_dups(single_candidates).length >= 8){
				let board = '';
				let givens_idxs = [];
				for(const i in this.SQUARES){
					const square = this.SQUARES[i];
					if(candidates[square].length == 1){
						board += candidates[square];
						givens_idxs.push(i);
					} else {
						board += this.BLANK_CHAR;
					}
				}
                
				// If we have more than `difficulty` givens, remove some random
				// givens until we're down to exactly `difficulty`
				const nr_givens = givens_idxs.length;
				if(nr_givens > difficulty){
					givens_idxs = this._shuffle(givens_idxs);
					for(let i = 0; i < nr_givens - difficulty; ++i){
						const target = parseInt(givens_idxs[i]);
						board = board.substr(0, target) + this.BLANK_CHAR + 
                            board.substr(target + 1);
					}
				}
                
				// Double check board is solvable
				// TODO: Make a standalone board checker. Solve is expensive.
				if(this.solve(board)){
					return board;
				}
			}
		}
        
		// Give up and try a new puzzle
		return this.generate(difficulty);
	};

	// Solve
	// -------------------------------------------------------------------------
	solve = function(board, reverse){
		/* Solve a sudoku puzzle given a sudoku `board`, i.e., an 81-character 
        string of sudoku.DIGITS, 1-9, and spaces identified by '.', representing the
        squares. There must be a minimum of 17 givens. If the given board has no
        solutions, return false.
        
        Optionally set `reverse` to solve "backwards", i.e., rotate through the
        possibilities in reverse. Useful for checking if there is more than one
        solution.
        */
        
		// Assure a valid board
		const report = this.validate_board(board);
		if(report !== true){
			throw report;
		}
        
		// Check number of givens is at least MIN_GIVENS
		let nr_givens = 0;
		for(const i in board){
			if(board[i] !== this.BLANK_CHAR && this._in(board[i], this.DIGITS)){
				++nr_givens;
			}
		}
		if(nr_givens < this.MIN_GIVENS){
			throw 'Too few givens. Minimum givens is ' + this.MIN_GIVENS;
		}

		// Default reverse to false
		reverse = reverse || false;

		const candidates = this._get_candidates_map(board);
		const result = this._search(candidates, reverse);
        
		if(result){
			let solution = '';
			for(const square in result){
				solution += result[square];
			}
			return solution;
		}
		return false;
	};

	get_candidates = function(board){
		/* Return all possible candidatees for each square as a grid of 
        candidates, returnning `false` if a contradiction is encountered.
        
        Really just a wrapper for sudoku._get_candidates_map for programmer
        consumption.
        */
        
		// Assure a valid board
		const report = this.validate_board(board);
		if(report !== true){
			throw report;
		}
        
		// Get a candidates map
		const candidates_map = this._get_candidates_map(board);
        
		// If there's an error, return false
		if(!candidates_map){
			return false;
		}
        
		// Transform candidates map into grid
		const rows = [];
		let cur_row = [];
		let i = 0;
		for(const square in candidates_map){
			const candidates = candidates_map[square];
			cur_row.push(candidates);
			if(i % 9 == 8){
				rows.push(cur_row);
				cur_row = [];
			}
			++i;
		}
		return rows;
	};

	_get_candidates_map(board){
		/* Get all possible candidates for each square as a map in the form
        {square: sudoku.DIGITS} using recursive constraint propagation. Return `false` 
        if a contradiction is encountered
        */
        
		// Assure a valid board
		const report = this.validate_board(board);
		if(report !== true){
			throw report;
		}
        
		const candidate_map = {};
		const squares_values_map = this._get_square_vals_map(board);
        
		// Start by assigning every digit as a candidate to every square
		for(const si in this.SQUARES){
			candidate_map[this.SQUARES[si]] = this.DIGITS;
		}
        
		// For each non-blank square, assign its value in the candidate map and
		// propigate.
		for(const square in squares_values_map){
			const val = squares_values_map[square];
            
			if(this._in(val, this.DIGITS)){
				const new_candidates = this._assign(candidate_map, square, val);
                
				// Fail if we can't assign val to square
				if(!new_candidates){
					return false;
				}
			}
		}
        
		return candidate_map;
	}

	_search = function(candidates, reverse){
		/* Given a map of squares -> candiates, using depth-first search, 
        recursively try all possible values until a solution is found, or false
        if no solution exists. */
        
		// Return if error in previous iteration
		if(!candidates){
			return false;
		}
        
		// Default reverse to false
		reverse = reverse || false;
        
		// If only one candidate for every square, we've a solved puzzle!
		// Return the candidates map.
		let max_nr_candidates = 0;
		for(const si in this.SQUARES){
			const square = this.SQUARES[si];
            
			const nr_candidates = candidates[square].length;
                
			if(nr_candidates > max_nr_candidates){
				max_nr_candidates = nr_candidates;
			}
		}

		if(max_nr_candidates === 1){
			return candidates;
		}
        
		// Choose the blank square with the fewest possibilities > 1
		let min_nr_candidates = 10;
		let min_candidates_square = null;
		for(const si in this.SQUARES){
			const square = this.SQUARES[si];
            
			const nr_candidates = candidates[square].length;
            
			if(nr_candidates < min_nr_candidates && nr_candidates > 1){
				min_nr_candidates = nr_candidates;
				min_candidates_square = square;
			}
		}
        
		// Recursively search through each of the candidates of the square 
		// starting with the one with fewest candidates.
        
		// Rotate through the candidates forwards
		const min_candidates = candidates[min_candidates_square];
		if(!reverse){
			for(const vi in min_candidates){
				const val = min_candidates[vi];
                
				// TODO: Implement a non-rediculous deep copy function
				const candidates_copy = JSON.parse(JSON.stringify(candidates));
				const candidates_next = this._search(
					this._assign(candidates_copy, min_candidates_square, val)
				);
                
				if(candidates_next){
					return candidates_next;
				}
			}
            
			// Rotate through the candidates backwards
		} else {
			for(let vi = min_candidates.length - 1; vi >= 0; --vi){
				const val = min_candidates[vi];
                
				// TODO: Implement a non-rediculous deep copy function
				const candidates_copy = JSON.parse(JSON.stringify(candidates));
				const candidates_next = this._search(
					this._assign(candidates_copy, min_candidates_square, val), 
					reverse
				);
                
				if(candidates_next){
					return candidates_next;
				}
			}
		}
        
		// If we get through all combinations of the square with the fewest
		// candidates without finding an answer, there isn't one. Return false.
		return false;
	};

	_assign(candidates, square, val){
		/* Eliminate all values, *except* for `val`, from `candidates` at 
        `square` (candidates[square]), and propagate. Return the candidates map
        when finished. If a contradiciton is found, return false.
        
        WARNING: This will modify the contents of `candidates` directly.
        */

		// Grab a list of canidates without 'val'
		const other_vals = candidates[square].replace(val, '');

		// Loop through all other values and eliminate them from the candidates 
		// at the current square, and propigate. If at any point we get a 
		// contradiction, return false.
		for(const ovi in other_vals){
			const other_val = other_vals[ovi];

			const candidates_next =
                this._eliminate(candidates, square, other_val);

			if(!candidates_next){
				//console.log("Contradiction found by _eliminate.");
				return false;
			}
		}

		return candidates;
	}

	_eliminate(candidates, square, val){
		/* Eliminate `val` from `candidates` at `square`, (candidates[square]),
        and propagate when values or places <= 2. Return updated candidates,
        unless a contradiction is detected, in which case, return false.
        
        WARNING: This will modify the contents of `candidates` directly.
        */

		// If `val` has already been eliminated from candidates[square], return
		// with candidates.
		if(!this._in(val, candidates[square])){
			return candidates;
		}

		// Remove `val` from candidates[square]
		candidates[square] = candidates[square].replace(val, '');
           
		// If the square has only candidate left, eliminate that value from its 
		// peers
		const nr_candidates = candidates[square].length;
		if(nr_candidates === 1){
			const target_val = candidates[square];
            
			for(const pi in this.SQUARE_PEERS_MAP[square]){
				const peer = this.SQUARE_PEERS_MAP[square][pi];
                
				const candidates_new = 
                        this._eliminate(candidates, peer, target_val);
                        
				if(!candidates_new){
					return false;
				}
			}
        
			// Otherwise, if the square has no candidates, we have a contradiction.
			// Return false.
		} if(nr_candidates === 0){
			return false;
		}
        
		// If a unit is reduced to only one place for a value, then assign it
		for(const ui in this.SQUARE_UNITS_MAP[square]){
			const unit = this.SQUARE_UNITS_MAP[square][ui];
            
			const val_places = [];
			for(const si in unit){
				const unit_square = unit[si];
				if(this._in(val, candidates[unit_square])){
					val_places.push(unit_square);
				}
			}
            
			// If there's no place for this value, we have a contradition!
			// return false
			if(val_places.length === 0){
				return false;
                
				// Otherwise the value can only be in one place. Assign it there.
			} else if(val_places.length === 1){
				const candidates_new = 
                    this._assign(candidates, val_places[0], val);
                
				if(!candidates_new){
					return false;
				}
			}
		}
        
		return candidates;
	}

	// Square relationships
	// -------------------------------------------------------------------------
	// Squares, and their relationships with values, units, and peers.
    
	_get_square_vals_map(board){
		/* Return a map of squares -> values
        */
		const squares_vals_map = {};
        
		// Make sure `board` is a string of length 81
		if(board.length != this.SQUARES.length){
			throw 'Board/squares length mismatch.';
            
		} else {
			for(const i in this.SQUARES){
				squares_vals_map[this.SQUARES[i]] = board[i];
			}
		}
        
		return squares_vals_map;
	}

	_get_square_units_map(squares, units){
		/* Return a map of `squares` and their associated units (row, col, box)
        */
		const square_unit_map = {};

		// For every square...
		for(const si in squares){
			const cur_square = squares[si];

			// Maintain a list of the current square's units
			const cur_square_units = [];

			// Look through the units, and see if the current square is in it,
			// and if so, add it to the list of of the square's units.
			for(const ui in units){
				const cur_unit = units[ui];

				if(cur_unit.indexOf(cur_square) !== -1){
					cur_square_units.push(cur_unit);
				}
			}

			// Save the current square and its units to the map
			square_unit_map[cur_square] = cur_square_units;
		}

		return square_unit_map;
	}

	_get_square_peers_map(squares, units_map){
		/* Return a map of `squares` and their associated peers, i.e., a set of
        other squares in the square's unit.
        */
		const square_peers_map = {};

		// For every square...
		for(const si in squares){
			const cur_square = squares[si];
			const cur_square_units = units_map[cur_square];

			// Maintain list of the current square's peers
			const cur_square_peers = [];

			// Look through the current square's units map...
			for(const sui in cur_square_units){
				const cur_unit = cur_square_units[sui];

				for(const ui in cur_unit){
					const cur_unit_square = cur_unit[ui];

					if(cur_square_peers.indexOf(cur_unit_square) === -1 && 
                            cur_unit_square !== cur_square){
						cur_square_peers.push(cur_unit_square);
					}
				}
			}
            
			// Save the current square an its associated peers to the map
			square_peers_map[cur_square] = cur_square_peers;
		}

		return square_peers_map;
	}
    
	_get_all_units(rows, cols){
		/* Return a list of all units (rows, cols, boxes)
        */
		const units = [];

		// Rows
		for(const ri in rows){
			units.push(this._cross(rows[ri], cols));
		}

		// Columns
		for(const ci in cols){
			units.push(this._cross(rows, cols[ci]));
		}

		// Boxes
		const row_squares = ['ABC', 'DEF', 'GHI'];
		const col_squares = ['123', '456', '789'];
		for(const rsi in row_squares){
			for(const csi in col_squares){
				units.push(this._cross(row_squares[rsi], col_squares[csi]));
			}
		}

		return units;
	}

	// Conversions
	// -------------------------------------------------------------------------
	board_string_to_grid(board_string){
		/* Convert a board string to a two-dimensional array
        */
		const rows = [];
		let cur_row = [];
		for(const i in board_string){
			cur_row.push(board_string[i]);
			if(i % 9 == 8){
				rows.push(cur_row);
				cur_row = [];
			}
		}
		return rows;
	}
    
	board_grid_to_string(board_grid){
		/* Convert a board grid to a string
        */
		let board_string = '';
		for(let r = 0; r < 9; ++r){
			for(let c = 0; c < 9; ++c){
				board_string += board_grid[r][c];
			}   
		}
		return board_string;
	}

	// Utility
	// -------------------------------------------------------------------------

	print_board(board){
		/* Print a sudoku `board` to the console. */
        
		// Assure a valid board
		const report = this.validate_board(board);
		if(report !== true){
			throw report;
		}
        
		const V_PADDING = ' ';  // Insert after each square
		const H_PADDING = '\n'; // Insert after each row
        
		const V_BOX_PADDING = '  '; // Box vertical padding
		const H_BOX_PADDING = '\n'; // Box horizontal padding

		let display_string = '';
        
		for(const i in board){
			const square = board[i];
            
			// Add the square and some padding
			display_string += square + V_PADDING;
            
			// Vertical edge of a box, insert v. box padding
			if(i % 3 === 2){
				display_string += V_BOX_PADDING;
			}
            
			// End of a line, insert horiz. padding
			if(i % 9 === 8){
				display_string += H_PADDING;
			}
            
			// Horizontal edge of a box, insert h. box padding
			if(i % 27 === 26){
				display_string += H_BOX_PADDING;
			}
		}

		console.log(display_string);
	}

	validate_board(board){
		/* Return if the given `board` is valid or not. If it's valid, return
        true. If it's not, return a string of the reason why it's not. */
        
		// Check for empty board
		if(!board){
			return 'Empty board';
		}
        
		// Invalid board length
		if(board.length !== this.NR_SQUARES){
			return 'Invalid board size. Board must be exactly ' + this.NR_SQUARES +
                    ' squares.';
		}
        
		// Check for invalid characters
		for(const i in board){
			if(!this._in(board[i], this.DIGITS) && board[i] !== this.BLANK_CHAR){
				return 'Invalid board character encountered at index ' + i + 
                        ': ' + board[i];
			}
		}
        
		// Otherwise, we're good. Return true.
		return true;
	}

	_cross(a, b) {
		/* Cross product of all elements in `a` and `b`, e.g.,
        sudoku._cross("abc", "123") ->
        ["a1", "a2", "a3", "b1", "b2", "b3", "c1", "c2", "c3"]
        */
		const result = [];
		for(const ai in a){
			for(const bi in b){
				result.push(a[ai] + b[bi]);
			}
		}
		return result;
	}

	_in(v, seq){
		/* Return if a value `v` is in sequence `seq`.
        */
		return seq.indexOf(v) !== -1;
	}

	_first_true = function(seq){
		/* Return the first element in `seq` that is true. If no element is
        true, return false.
        */
		for(const i in seq){
			if(seq[i]){
				return seq[i];
			}
		}
		return false;
	};

	_shuffle(seq){
		/* Return a shuffled version of `seq` */
        
		// Create an array of the same size as `seq` filled with false
		const shuffled = [];
		for(let i = 0; i < seq.length; ++i){
			shuffled.push(false);
		}
        
		for(let i in seq){
			let ti = this._rand_range(seq.length);
            
			while(shuffled[ti]){
				ti = (ti + 1) > (seq.length - 1) ? 0 : (ti + 1);
			}
            
			shuffled[ti] = seq[i];
		}
        
		return shuffled;
	}

	_rand_range = function(max, min){
		/* Get a random integer in the range of `min` to `max` (non inclusive).
        If `min` not defined, default to 0. If `max` not defined, throw an 
        error. */
		min = min || 0;
		if(max){
			return Math.floor(Math.random() * (max - min)) + min;
		} else {
			throw 'Range undefined';
		}
	};

	_strip_dups = function(seq){
		/* Strip duplicate values from `seq` */
		const seq_set = [];
		const dup_map = {};
		for(const i in seq){
			const e = seq[i];
			if(!dup_map[e]){
				seq_set.push(e);
				dup_map[e] = true;
			}
		}
		return seq_set;
	};
    
	_force_range(nr, max, min){
		/* Force `nr` to be within the range from `min` to, but not including, 
        `max`. `min` is optional, and will default to 0. If `nr` is undefined,
        treat it as zero. */
		min = min || 0;
		nr = nr || 0;
		if(nr < min){
			return min;
		}
		if(nr > max){
			return max;
		}
		return nr;
	}
}