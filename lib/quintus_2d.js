/*global Quintus:false, module:false */

var quintus2D = function(Quintus) {
  'use strict';

  Quintus['2D'] = function(Q) {
    Q.component('viewport', {
      added: function() {
        this.entity.on('prerender', this, 'prerender');
        this.entity.on('render', this, 'postrender');
        this.x = 0;
        this.y = 0;
        this.offsetX = 0;
        this.offsetY = 0;
        this.centerX = Q.width / 2;
        this.centerY = Q.height / 2;
        this.scale = 1;
      },

      extend: {
        follow: function(sprite, directions, boundingBox) {
          this.off('poststep', this.viewport, 'follow');
          this.viewport.directions = directions || { x: true, y: true };
          this.viewport.following = sprite;
          if (
            Q._isUndefined(boundingBox) &&
            this.lists.TileLayer !== undefined
          ) {
            this.viewport.boundingBox = Q._detect(
              this.lists.TileLayer,
              function(layer) {
                return layer.p.boundingBox
                  ? { minX: 0, maxX: layer.p.w, minY: 0, maxY: layer.p.h }
                  : null;
              }
            );
          } else {
            this.viewport.boundingBox = boundingBox;
          }
          this.on('poststep', this.viewport, 'follow');
          this.viewport.follow(true);
        },

        unfollow: function() {
          this.off('poststep', this.viewport, 'follow');
        },

        centerOn: function(x, y) {
          this.viewport.centerOn(x, y);
        },

        moveTo: function(x, y) {
          return this.viewport.moveTo(x, y);
        },
      },

      follow: function(first) {
        var followX = Q._isFunction(this.directions.x)
          ? this.directions.x(this.following)
          : this.directions.x;
        var followY = Q._isFunction(this.directions.y)
          ? this.directions.y(this.following)
          : this.directions.y;

        this[first === true ? 'centerOn' : 'softCenterOn'](
          followX ? this.following.p.x - this.offsetX : undefined,
          followY ? this.following.p.y - this.offsetY : undefined
        );
      },

      offset: function(x, y) {
        this.offsetX = x;
        this.offsetY = y;
      },

      softCenterOn: function(x, y) {
        if (x !== void 0) {
          var dx = (x - Q.width / 2 / this.scale - this.x) / 3;
          if (this.boundingBox) {
            if (this.x + dx < this.boundingBox.minX) {
              this.x = this.boundingBox.minX / this.scale;
            } else if (
              this.x + dx >
              (this.boundingBox.maxX - Q.width) / this.scale
            ) {
              this.x =
                Math.max(
                  this.boundingBox.maxX - Q.width,
                  this.boundingBox.minX
                ) / this.scale;
            } else {
              this.x += dx;
            }
          } else {
            this.x += dx;
          }
        }
        if (y !== void 0) {
          var dy = (y - Q.height / 2 / this.scale - this.y) / 3;
          if (this.boundingBox) {
            if (this.y + dy < this.boundingBox.minY) {
              this.y = this.boundingBox.minY / this.scale;
            } else if (
              this.y + dy >
              (this.boundingBox.maxY - Q.height) / this.scale
            ) {
              this.y =
                Math.max(
                  this.boundingBox.maxY - Q.height,
                  this.boundingBox.minY
                ) / this.scale;
            } else {
              this.y += dy;
            }
          } else {
            this.y += dy;
          }
        }
      },
      centerOn: function(x, y) {
        if (x !== void 0) {
          this.x = x - Q.width / 2 / this.scale;
        }
        if (y !== void 0) {
          this.y = y - Q.height / 2 / this.scale;
        }
      },

      moveTo: function(x, y) {
        if (x !== void 0) {
          this.x = x;
        }
        if (y !== void 0) {
          this.y = y;
        }
        return this.entity;
      },

      prerender: function() {
        this.centerX = this.x + Q.width / 2 / this.scale;
        this.centerY = this.y + Q.height / 2 / this.scale;
        Q.ctx.save();
        Q.ctx.translate(Math.floor(Q.width / 2), Math.floor(Q.height / 2));
        Q.ctx.scale(this.scale, this.scale);
        Q.ctx.translate(-Math.floor(this.centerX), -Math.floor(this.centerY));
      },

      postrender: function() {
        Q.ctx.restore();
      },
    });

    Q.Sprite.extend('TileLayer', {
      init: function(props) {
        this._super(props, {
          tileW: 32,
          tileH: 32,
          blockTileW: 10,
          blockTileH: 10,
          type: 1,
          renderAlways: true,
        });
        if (this.p.dataAsset) {
          this.load(this.p.dataAsset);
        }

        this.setDimensions();

        this.blocks = [];
        this.p.blockW = this.p.tileW * this.p.blockTileW;
        this.p.blockH = this.p.tileH * this.p.blockTileH;
        this.colBounds = {};
        this.directions = ['top', 'left', 'right', 'bottom'];
        this.tileProperties = {};

        this.collisionObject = {
          p: {
            w: this.p.tileW,
            h: this.p.tileH,
            cx: this.p.tileW / 2,
            cy: this.p.tileH / 2,
          },
        };

        this.tileCollisionObjects = {};

        this.collisionNormal = { separate: [] };

        this._generateCollisionObjects();
      },

      // Generate the tileCollisionObject overrides where needed
      _generateCollisionObjects: function() {
        var self = this;

        function returnPoint(pt) {
          return [
            pt[0] * self.p.tileW - self.p.tileW / 2,
            pt[1] * self.p.tileH - self.p.tileH / 2,
          ];
        }

        if (this.sheet() && this.sheet().frameProperties) {
          var frameProperties = this.sheet().frameProperties;
          for (var k in frameProperties) {
            var colObj = (this.tileCollisionObjects[k] = {
              p: Q._clone(this.collisionObject.p),
            });
            Q._extend(colObj.p, frameProperties[k]);

            if (colObj.p.points) {
              colObj.p.points = Q._map(colObj.p.points, returnPoint);
            }

            this.tileCollisionObjects[k] = colObj;
          }
        }
      },

      load: function(dataAsset) {
        var fileParts = dataAsset.split('.'),
          fileExt = fileParts[fileParts.length - 1].toLowerCase(),
          data;

        if (fileExt === 'json') {
          data = Q._isString(dataAsset) ? Q.asset(dataAsset) : dataAsset;
        } else {
          throw 'file type not supported';
        }
        this.p.tiles = data;
      },

      setDimensions: function() {
        var tiles = this.p.tiles;

        if (tiles) {
          this.p.rows = tiles.length;
          this.p.cols = tiles[0].length;
          this.p.w = this.p.cols * this.p.tileW;
          this.p.h = this.p.rows * this.p.tileH;
        }
      },

      getTile: function(tileX, tileY) {
        return this.p.tiles[tileY] && this.p.tiles[tileY][tileX];
      },

      getTileProperty: function(tile, prop) {
        if (this.tileProperties[tile] !== undefined) {
          return this.tileProperties[tile][prop];
        } else {
          return;
        }
      },

      getTileProperties: function(tile) {
        if (this.tileProperties[tile] !== undefined) {
          return this.tileProperties[tile];
        } else {
          return {};
        }
      },

      getTilePropertyAt: function(tileX, tileY, prop) {
        return this.getTileProperty(this.getTile(tileX, tileY), prop);
      },

      getTilePropertiesAt: function(tileX, tileY) {
        return this.getTileProperties(this.getTile(tileX, tileY));
      },

      tileHasProperty: function(tile, prop) {
        return this.getTileProperty(tile, prop) !== undefined;
      },

      setTile: function(x, y, tile) {
        var p = this.p,
          blockX = Math.floor(x / p.blockTileW),
          blockY = Math.floor(y / p.blockTileH);

        if (x >= 0 && x < this.p.cols && y >= 0 && y < this.p.rows) {
          this.p.tiles[y][x] = tile;

          if (this.blocks[blockY]) {
            this.blocks[blockY][blockX] = null;
          }
        }
      },

      tilePresent: function(tileX, tileY) {
        return (
          this.p.tiles[tileY] && this.collidableTile(this.p.tiles[tileY][tileX])
        );
      },

      // Overload this method to draw tiles at frame 0 or not draw
      // tiles at higher number frames
      drawableTile: function(tileNum) {
        return tileNum > 0;
      },

      // Overload this method to control which tiles trigger a collision
      // (defaults to all tiles > number 0)
      collidableTile: function(tileNum) {
        return tileNum > 0;
      },

      getCollisionObject: function(tileX, tileY) {
        var p = this.p,
          tile = this.getTile(tileX, tileY),
          colObj;

        colObj =
          this.tileCollisionObjects[tile] !== undefined
            ? this.tileCollisionObjects[tile]
            : this.collisionObject;

        colObj.p.x = tileX * p.tileW + p.x + p.tileW / 2;
        colObj.p.y = tileY * p.tileH + p.y + p.tileH / 2;

        return colObj;
      },

      collide: function(obj) {
        var p = this.p,
          objP = obj.c || obj.p,
          tileStartX = Math.floor((objP.x - objP.cx - p.x) / p.tileW),
          tileStartY = Math.floor((objP.y - objP.cy - p.y) / p.tileH),
          tileEndX = Math.ceil((objP.x - objP.cx + objP.w - p.x) / p.tileW),
          tileEndY = Math.ceil((objP.y - objP.cy + objP.h - p.y) / p.tileH),
          normal = this.collisionNormal,
          col,
          colObj;

        normal.collided = false;

        for (var tileY = tileStartY; tileY <= tileEndY; tileY++) {
          for (var tileX = tileStartX; tileX <= tileEndX; tileX++) {
            if (this.tilePresent(tileX, tileY)) {
              colObj = this.getCollisionObject(tileX, tileY);

              col = Q.collision(obj, colObj);

              if (col && col.magnitude > 0) {
                if (colObj.p.sensor) {
                  colObj.tile = this.getTile(tileX, tileY);
                  if (obj.trigger) {
                    obj.trigger('sensor.tile', colObj);
                  }
                } else if (
                  !normal.collided ||
                  normal.magnitude < col.magnitude
                ) {
                  normal.collided = true;
                  normal.separate[0] = col.separate[0];
                  normal.separate[1] = col.separate[1];
                  normal.magnitude = col.magnitude;
                  normal.distance = col.distance;
                  normal.normalX = col.normalX;
                  normal.normalY = col.normalY;
                  normal.tileX = tileX;
                  normal.tileY = tileY;
                  normal.tile = this.getTile(tileX, tileY);
                  if (obj.p.collisions !== undefined) {
                    obj.p.collisions.push(normal);
                  }
                }
              }
            }
          }
        }

        return normal.collided ? normal : false;
      },

      prerenderBlock: function(blockX, blockY) {
        var p = this.p,
          tiles = p.tiles,
          sheet = this.sheet(),
          blockOffsetX = blockX * p.blockTileW,
          blockOffsetY = blockY * p.blockTileH;

        if (
          blockOffsetX < 0 ||
          blockOffsetX >= this.p.cols ||
          blockOffsetY < 0 ||
          blockOffsetY >= this.p.rows
        ) {
          return;
        }

        var canvas = document.createElement('canvas'),
          ctx = canvas.getContext('2d');

        canvas.width = p.blockW;
        canvas.height = p.blockH;
        this.blocks[blockY] = this.blocks[blockY] || {};
        this.blocks[blockY][blockX] = canvas;

        for (var y = 0; y < p.blockTileH; y++) {
          if (tiles[y + blockOffsetY]) {
            for (var x = 0; x < p.blockTileW; x++) {
              if (
                this.drawableTile(tiles[y + blockOffsetY][x + blockOffsetX])
              ) {
                sheet.draw(
                  ctx,
                  x * p.tileW,
                  y * p.tileH,
                  tiles[y + blockOffsetY][x + blockOffsetX]
                );
              }
            }
          }
        }
      },

      drawBlock: function(ctx, blockX, blockY) {
        var p = this.p,
          startX = Math.floor(blockX * p.blockW + p.x),
          startY = Math.floor(blockY * p.blockH + p.y);

        if (!this.blocks[blockY] || !this.blocks[blockY][blockX]) {
          this.prerenderBlock(blockX, blockY);
        }

        if (this.blocks[blockY] && this.blocks[blockY][blockX]) {
          ctx.drawImage(this.blocks[blockY][blockX], startX, startY);
        }
      },

      draw: function(ctx) {
        var p = this.p,
          viewport = this.stage.viewport,
          scale = viewport ? viewport.scale : 1,
          x = viewport ? viewport.x : 0,
          y = viewport ? viewport.y : 0,
          viewW = Q.width / scale,
          viewH = Q.height / scale,
          startBlockX = Math.floor((x - p.x) / p.blockW),
          startBlockY = Math.floor((y - p.y) / p.blockH),
          endBlockX = Math.floor((x + viewW - p.x) / p.blockW),
          endBlockY = Math.floor((y + viewH - p.y) / p.blockH);

        for (var iy = startBlockY; iy <= endBlockY; iy++) {
          for (var ix = startBlockX; ix <= endBlockX; ix++) {
            this.drawBlock(ctx, ix, iy);
          }
        }
      },
    });

    Q.gravityY = 9.8 * 100;
    Q.gravityX = 0;

    Q.component('2d', {
      added: function() {
        var entity = this.entity;
        Q._defaults(entity.p, {
          vx: 0,
          vy: 0,
          ax: 0,
          ay: 0,
          gravity: 1,
          collisionMask: Q.SPRITE_DEFAULT,
        });
        entity.on('step', this, 'step');
        entity.on('hit', this, 'collision');
      },

      collision: function(col, last) {
        var entity = this.entity,
          p = entity.p,
          magnitude = 0;

        if (col.obj.p && col.obj.p.sensor) {
          col.obj.trigger('sensor', entity);
          return;
        }

        col.impact = 0;
        var impactX = Math.abs(p.vx);
        var impactY = Math.abs(p.vy);

        p.x -= col.separate[0];
        p.y -= col.separate[1];

        // Top collision
        if (col.normalY < -0.3) {
          if (!p.skipCollide && p.vy > 0) {
            p.vy = 0;
          }
          col.impact = impactY;
          entity.trigger('bump.bottom', col);
        }
        if (col.normalY > 0.3) {
          if (!p.skipCollide && p.vy < 0) {
            p.vy = 0;
          }
          col.impact = impactY;

          entity.trigger('bump.top', col);
        }

        if (col.normalX < -0.3) {
          if (!p.skipCollide && p.vx > 0) {
            p.vx = 0;
          }
          col.impact = impactX;
          entity.trigger('bump.right', col);
        }
        if (col.normalX > 0.3) {
          if (!p.skipCollide && p.vx < 0) {
            p.vx = 0;
          }
          col.impact = impactX;

          entity.trigger('bump.left', col);
        }
      },

      step: function(dt) {
        var p = this.entity.p,
          dtStep = dt;
        // TODO: check the entity's magnitude of vx and vy,
        // reduce the max dtStep if necessary to prevent
        // skipping through objects.
        while (dtStep > 0) {
          dt = Math.min(1 / 30, dtStep);
          // Updated based on the velocity and acceleration
          p.vx +=
            p.ax * dt +
            (p.gravityX === void 0 ? Q.gravityX : p.gravityX) * dt * p.gravity;
          p.vy +=
            p.ay * dt +
            (p.gravityY === void 0 ? Q.gravityY : p.gravityY) * dt * p.gravity;
          p.x += p.vx * dt;
          p.y += p.vy * dt;

          this.entity.stage.collide(this.entity);
          dtStep -= dt;
        }
      },
    });

    Q.component('aiBounce', {
      added: function() {
        this.entity.on('bump.right', this, 'goLeft');
        this.entity.on('bump.left', this, 'goRight');
      },

      goLeft: function(col) {
        this.entity.p.vx = -col.impact;
        if (this.entity.p.defaultDirection === 'right') {
          this.entity.p.flip = 'x';
        } else {
          this.entity.p.flip = false;
        }
      },

      goRight: function(col) {
        this.entity.p.vx = col.impact;
        if (this.entity.p.defaultDirection === 'left') {
          this.entity.p.flip = 'x';
        } else {
          this.entity.p.flip = false;
        }
      },
    });

    /**
     * Tracking AI component
     *
     * Adds Sprite Tracking (square grid based) onto a Sprite
     *
     * Adds the following properties to the entity:
     *
     *      {
     *        view_range: 5, // range of detection to trigger movement (number of tiles)
     *        attack_range: 1  // range of detection to trigger an attack (number of tiles)
     *        tile_size: 32  // size of a tile
     *        vfactor: 1  // the speed on x or y axis is incremented by tile_size*vfactor
     *        attacking: false // true when the ai is performing an attack
     *        tracking: false // true when the ai is tracking an enemy
     *        reloadSpeed: 60 // Speed the ai takes between attacks
     *        reload: reloadSpeed // current reload time
     *        track_class: Player // Array of sprites to track
     *      }
     *
     *
     * @class stepControls
     * @for Quintus.2d
     */
    Q.component('aiTrack', {
      added: function() {
        const p = this.entity.p;

        if (!p.view_range) {
          p.view_range = 10;
        }
        if (!p.attack_range) {
          p.attack_range = 3;
        }
        if (!p.tile_size) {
          p.tile_size = 32;
        }
        if (!p.vfactor) {
          p.vfactor = 1;
        }
        if (!p.attacking) {
          p.attacking = false;
        }
        if (!p.tracking) {
          p.tracking = false;
        }
        if (!p.reloadSpeed) {
          p.reloadSpeed = 1;
        }
        if (!p.reload) {
          p.reload = p.reloadSpeed;
        }
        if (!p.track_class) {
          p.track_class = ['Player'];
        }

        this.entity.on('step', this, function(dt) {
          Q.stage(1).triggerRange();
          this.entity.p.reload -= dt;
        });
        this.entity.on('range.check', this, 'range');
        this.entity.on('range.view', this, 'move');
        this.entity.on('range.attack', this, 'attack');
      },

      range: function(sprites) {
        const p = this.entity.p;
        p.vx = 0;
        p.vy = 0;
        for (let i in sprites) {
          for (let j in p.track_class) {
            if (sprites[i].isA(p.track_class[j])) {
              const other = sprites[i].p;
              // Pythagoras to find out distance
              const d =
                Math.sqrt((p.x - other.x) ** 2 + (p.y - other.y) ** 2) /
                p.tile_size;
              if (d <= p.attack_range) {
                this.entity.trigger('range.attack', sprites[i]);
              } else if (d <= p.view_range) {
                this.entity.trigger('range.view', sprites[i]);
              }
            }
          }
        }
      },

      move: function(obj) {
        this.entity.p.tracking = true;
        const p = this.entity.p;
        const other = obj.p;

        if (p.x < other.x) {
          p.vx = p.tile_size * p.vfactor;
          if (p.x + p.vx > other.x) {
            p.vx = other.x - p.x;
          }
        } else if (p.x > other.x) {
          p.vx = -p.tile_size * p.vfactor;
          if (p.x + p.vx < other.x) {
            p.vx = other.x - p.x;
          }
        } else {
          p.vx = 0;
        }

        if (p.y < other.y) {
          p.vy = p.tile_size * p.vfactor;
          if (p.y + p.vy > other.y) {
            p.vy = other.y - p.y;
          }
        } else if (p.y > other.y) {
          p.vy = -p.tile_size * p.vfactor;
          if (p.y + p.vy < other.y) {
            p.vy = other.y - p.y;
          }
        } else {
          p.vy = 0;
        }
      },

      attack: function(obj) {
        const pos = { x: this.entity.p.x, y: this.entity.p.y };
        const other_pos = { x: obj.p.x, y: obj.p.y };
        if (
          !this.entity.p.damage ||
          this.entity.p.reload > 0 ||
          !aifacing(this.entity.p.direction, pos, other_pos)
        )
          return;
        this.entity.p.attacking = true;
        this.entity.p.reload = this.entity.p.reloadSpeed;
        obj.hit(this.entity.p.damage, pos);
      },
    });
  };
};

if (typeof Quintus === 'undefined') {
  module.exports = quintus2D;
} else {
  quintus2D(Quintus);
}

///////////// Aux functions //////////////////
function aifacing(direction, source, target) {
  switch (direction) {
    case 'up':
      return source.y > target.y;
    case 'down':
      return source.y < target.y;
    case 'left':
      return source.x > target.x;
    case 'right':
      return source.x < target.x;
  }
}
