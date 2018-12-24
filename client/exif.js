const tiffTags = {
	0x0112 : "Orientation",
	0x0132 : "DateTime",
	0x010F : "Make",
	0x0110 : "Model"
};

class Exif {


	static read( arrayBuffer, file ){
		const dataView = new DataView( arrayBuffer );

		if( (dataView.getUint8(0) !== 0xFF) || (dataView.getUint8(1) !== 0xD8) ){
			throw new Error(`File is not a JPEG image: ${file.name}`);
		}

		let offset = 2;
		let marker;

		while( offset < arrayBuffer.byteLength ){
			if( dataView.getUint8( offset ) !== 0xFF ){
				throw new Error("Not a valid JPEG");
				return;
			}

			marker = dataView.getUint8( offset + 1 );
			if( marker === 225 ){
				const exif = this._readEXIFData( dataView, offset + 4, dataView.getUint16( offset + 2 ) - 2 );
				return exif;
			} else {
				offset += 2 + dataView.getUint16( offset + 2 );
			}
		}

		throw new Error(`Could not read exif data: ${file.name}`);
	}

	static _readEXIFData( file, start ){
		if( this._getStringFromBuffer( file, start, 4) != 'Exif' ) return null;

		let bigEnd;
		const tiffOffset = start + 6;

		if( file.getUint16(tiffOffset) == 0x4949 ){
			bigEnd = false;
		}else if( file.getUint16(tiffOffset) == 0x4D4D ){
			bigEnd = true;
		}else{
			return null;
		}

		if( file.getUint16( tiffOffset + 2, !bigEnd ) != 0x002A ) return null;

		const firstIFDOffset = file.getUint32( tiffOffset + 4, !bigEnd );
		if( firstIFDOffset < 0x00000008 ) return null;

		return this._readTags( file, tiffOffset, tiffOffset + firstIFDOffset, bigEnd );
	}

	static _readTags( file, tiffStart, dirStart, bigEnd ){
		const entries = file.getUint16(dirStart, !bigEnd);
		const tags = {};
		let entryOffset = 0;
		let tag = null;

		for( var i = 0; i < entries; i++ ){
			entryOffset = dirStart + i * 12 + 2;
			tag = tiffTags[ file.getUint16( entryOffset, !bigEnd ) ];
			if( !tag ) continue;
			tags[tag] = this._readTagValue( file, entryOffset, tiffStart, dirStart, bigEnd );
		}

		return tags;
	}

	static _readTagValue( file, entryOffset, tiffStart, dirStart, bigEnd ){

		const type = file.getUint16( entryOffset + 2, !bigEnd );
		const numValues = file.getUint32( entryOffset + 4, !bigEnd) ;
		const valueOffset = file.getUint32( entryOffset + 8, !bigEnd ) + tiffStart;
		let offset;

		switch( type ){
			case 2: // ascii, 8-bit byte
				offset = numValues > 4 ? valueOffset : (entryOffset + 8);
				return this._getStringFromBuffer( file, offset, numValues - 1 );

			case 3: // short, 16 bit int
				if( numValues == 1 ){
					return file.getUint16(entryOffset + 8, !bigEnd);
				} else {
					offset = numValues > 2 ? valueOffset : (entryOffset + 8);
					var vals = [];
					for( var n = 0; n < numValues; n++ ){
						vals[n] = file.getUint16( offset + 2 * n, !bigEnd );
					}
					return vals;
				}
			default:
				break;
		}
	}

	static _getStringFromBuffer( buffer, start, length ){
		let outstr = '';
		for( var n = start; n < start + length; n++ ){
			outstr += String.fromCharCode( buffer.getUint8( n ) );
		}
		return outstr;
	}
	
}

export default Exif;

